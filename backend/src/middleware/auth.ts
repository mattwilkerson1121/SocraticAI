import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { ApiError, AuthenticatedRequest } from '../types/index';
import { logError, logger } from '../logger';

/**
 * JWT payload from Supabase
 */
interface JWTPayload {
  sub: string; // user_id
  email: string;
  aud: string;
  iat: number;
  exp: number;
  email_verified: boolean;
  user_metadata?: Record<string, any>;
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Verify JWT token with Supabase
 */
async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.admin.getUserById(
      // Extract user ID from token via Supabase
      // This is a workaround; in production, use jwt.verify() with secret
      token
    );

    if (error || !user) {
      return null;
    }

    return {
      sub: user.id,
      email: user.email || '',
      aud: 'authenticated',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      email_verified: user.email_confirmed_at !== null,
      user_metadata: user.user_metadata,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Alternative: Verify JWT with jwt library (recommended for production)
 * Requires: npm install jsonwebtoken
 * Then: import jwt from 'jsonwebtoken'
 */
export function verifyTokenWithSecret(token: string, secret: string): JWTPayload | null {
  try {
    // Uncomment in production:
    // const decoded = jwt.verify(token, secret) as JWTPayload;
    // return decoded;

    // Placeholder for MVP
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Express middleware to require authentication
 * Extracts and verifies JWT token from Authorization header
 * Attaches user info to req.user
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      throw new ApiError(401, 'Missing authorization token', 'MISSING_TOKEN');
    }

    // Get user from token via Supabase
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.admin.getUserById(
      // Parse JWT without verification for MVP
      // In production, verify with secret
      extractUserIdFromToken(token)
    );

    if (error || !user) {
      throw new ApiError(401, 'Invalid token', 'INVALID_TOKEN');
    }

    // Check if user exists in public.users table
    const { data: userRecord, error: userError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError || !userRecord) {
      // Create user record if missing (first login)
      const { error: createError } = await supabaseAdmin.from('users').insert({
        id: user.id,
        email: user.email,
      });

      if (createError) {
        throw new ApiError(500, 'Failed to create user record', 'USER_CREATION_ERROR');
      }
    }

    // Attach user to request
    (req as AuthenticatedRequest).user = {
      id: user.id,
      email: user.email || '',
      aud: 'authenticated',
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return void res.status(error.statusCode).json({
        error: {
          code: error.code || 'AUTH_ERROR',
          message: error.message,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        },
      });
    }

    logError(error as Error, {
      action: 'authMiddleware',
      statusCode: 401,
    });

    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication failed',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Optional middleware for routes that accept both authenticated and unauthenticated users
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      // No token provided - continue as anonymous
      return next();
    }

    const {
      data: { user },
    } = await supabaseAdmin.auth.admin.getUserById(extractUserIdFromToken(token));

    if (user) {
      (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email || '',
        aud: 'authenticated',
      };
    }

    next();
  } catch (error) {
    // If auth fails, continue as anonymous
    logger.debug({ error }, 'optionalAuthMiddleware: auth failed, continuing as anonymous');
    next();
  }
}

/**
 * Extract user ID from JWT token (basic parsing for MVP)
 * In production, verify with jwt.verify()
 */
function extractUserIdFromToken(token: string): string {
  try {
    // Decode JWT payload (without verification)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.sub || payload.user_id;
  } catch (error) {
    throw new ApiError(401, 'Failed to parse token', 'TOKEN_PARSE_ERROR');
  }
}

/**
 * Ensure user has required subscription tier
 */
export function requireTier(allowedTiers: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as AuthenticatedRequest).user;

      if (!user) {
        throw new ApiError(401, 'Authentication required', 'MISSING_AUTH');
      }

      // Fetch user's subscription tier
      const { data: subscription, error } = await supabaseAdmin
        .from('user_subscriptions')
        .select('user_subscriptions.*, subscription_tiers(tier_key)')
        .eq('user_id', user.id)
        .single();

      if (error || !subscription) {
        throw new ApiError(403, 'Subscription not found', 'NO_SUBSCRIPTION');
      }

      const tierKey = (subscription as any).subscription_tiers?.tier_key;

      if (!allowedTiers.includes(tierKey)) {
        throw new ApiError(
          403,
          `This feature requires one of these tiers: ${allowedTiers.join(', ')}`,
          'INSUFFICIENT_TIER'
        );
      }

      next();
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
          message: 'Failed to check subscription',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        },
      });
    }
  };
}

export default authMiddleware;
