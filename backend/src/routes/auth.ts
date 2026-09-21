import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger, logError } from '../logger';
import { ApiError, AuthPayload, AuthResponse } from '../types/index';
import authMiddleware from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password }: AuthPayload = req.body;

    // Validate input
    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required', 'MISSING_FIELDS');
    }

    if (password.length < 8) {
      throw new ApiError(400, 'Password must be at least 8 characters', 'WEAK_PASSWORD');
    }

    if (!email.includes('@')) {
      throw new ApiError(400, 'Invalid email format', 'INVALID_EMAIL');
    }

    logger.debug({ email }, 'Attempting user registration');

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for MVP
    });

    if (authError || !authData.user) {
      logger.warn({ email, error: authError }, 'User registration failed');
      throw new ApiError(400, authError?.message || 'Registration failed', 'AUTH_ERROR');
    }

    const userId = authData.user.id;

    // Create user profile
    const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
      user_id: userId,
      name: email.split('@')[0], // Use email prefix as default name
      tier: 'free',
    });

    if (profileError) {
      logger.error({ userId, error: profileError }, 'Failed to create user profile');
      // Continue anyway - profile can be created later
    }

    // Create default subscription (free tier)
    const { data: tiers } = await supabaseAdmin
      .from('subscription_tiers')
      .select('id')
      .eq('tier_key', 'free')
      .single();

    if (tiers) {
      const { error: subError } = await supabaseAdmin.from('user_subscriptions').insert({
        user_id: userId,
        tier_id: tiers.id,
        status: 'active',
      });

      if (subError) {
        logger.warn({ userId, error: subError }, 'Failed to create subscription');
      }
    }

    // Create default project
    const { error: projectError } = await supabaseAdmin.from('projects').insert({
      user_id: userId,
      name: 'My First Project',
      description: 'Default project for your Socratic sessions',
    });

    if (projectError) {
      logger.warn({ userId, error: projectError }, 'Failed to create default project');
    }

    logger.info({ userId, email }, 'User registered successfully');

    // Generate session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.createSession(
      userId
    );

    if (sessionError || !sessionData.session) {
      throw new ApiError(500, 'Failed to create session', 'SESSION_ERROR');
    }

    const response: AuthResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email || '',
        user_metadata: authData.user.user_metadata,
      },
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token || '',
        expires_in: sessionData.session.expires_in || 3600,
      },
    };

    res.status(201).json(response);
  } catch (error) {
    if (error instanceof ApiError) {
      return void res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
    }

    logError(error as Error, {
      action: 'POST /api/auth/register',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Registration failed',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password }: AuthPayload = req.body;

    if (!email || !password) {
      throw new ApiError(400, 'Email and password are required', 'MISSING_FIELDS');
    }

    logger.debug({ email }, 'User login attempt');

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      logger.warn({ email }, 'Login failed - invalid credentials');
      throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    logger.info({ userId: authData.user.id, email }, 'User login successful');

    const response: AuthResponse = {
      user: {
        id: authData.user.id,
        email: authData.user.email || '',
        user_metadata: authData.user.user_metadata,
      },
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token || '',
        expires_in: authData.session.expires_in || 3600,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    if (error instanceof ApiError) {
      return void res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
    }

    logError(error as Error, {
      action: 'POST /api/auth/login',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout the current user (revoke session)
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    logger.info({ userId: user.id }, 'User logout');

    // Revoke session in Supabase
    const { error } = await supabaseAdmin.auth.admin.signOut(user.id);

    if (error) {
      logger.warn({ userId: user.id, error }, 'Failed to revoke session');
    }

    res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    logError(error as Error, {
      action: 'POST /api/auth/logout',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      throw new ApiError(404, 'User profile not found', 'NOT_FOUND');
    }

    res.status(200).json(profile);
  } catch (error) {
    if (error instanceof ApiError) {
      return void res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch user profile',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
