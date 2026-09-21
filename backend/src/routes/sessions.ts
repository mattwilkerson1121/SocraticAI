import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger, logError } from '../logger';
import { ApiError, CreateSessionRequest, AuthenticatedRequest } from '../types/index';
import authMiddleware from '../middleware/auth';
import { isSuperAdmin } from '../utils/roles';

const router = Router();

// Protect all routes with authentication
router.use(authMiddleware);

/**
 * GET /api/sessions
 * List sessions for a project (optionally: all user sessions)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { projectId, limit = 50, offset = 0 } = req.query;

    logger.debug({ userId: user.id, projectId, role: user.role }, 'Fetching sessions');

    let query = supabaseAdmin
      .from('sessions')
      .select(
        `
        *,
        projects(id, name),
        messages(count)
      `,
        { count: 'exact' }
      );

    if (!isSuperAdmin(user.role)) {
      query = query.eq('user_id', user.id);
    }

    // Filter by project if provided
    if (projectId) {
      query = query.eq('project_id', projectId as string);
    }

    const { data: sessions, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (error) {
      throw new ApiError(500, 'Failed to fetch sessions', 'FETCH_ERROR');
    }

    res.status(200).json({
      data: sessions || [],
      total: count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      hasMore: (count || 0) > parseInt(offset as string) + parseInt(limit as string),
    });
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
      action: 'GET /api/sessions',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch sessions',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/sessions
 * Create a new session
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { project_id, title }: CreateSessionRequest = req.body;

    if (!project_id) {
      throw new ApiError(400, 'Project ID is required', 'MISSING_PROJECT_ID');
    }

    if (!title) {
      throw new ApiError(400, 'Session title is required', 'MISSING_TITLE');
    }

    if (title.length > 255) {
      throw new ApiError(400, 'Title too long (max 255 characters)', 'TITLE_TOO_LONG');
    }

    // Verify project exists and belongs to user
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', project_id)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    logger.debug({ userId: user.id, projectId: project_id, title }, 'Creating session');

    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .insert({
        user_id: user.id,
        project_id,
        title,
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, 'Failed to create session', 'CREATE_ERROR');
    }

    logger.info({ userId: user.id, sessionId: session.id, title }, 'Session created');

    res.status(201).json(session);
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
      action: 'POST /api/sessions',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create session',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * Get a specific session with messages
 */
router.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { sessionId } = req.params;

    const { data: session, error } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (error || !session) {
      throw new ApiError(404, 'Session not found', 'NOT_FOUND');
    }

    res.status(200).json(session);
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
        message: 'Failed to fetch session',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * PUT /api/sessions/:sessionId
 * Update a session title
 */
router.put('/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { sessionId } = req.params;
    const { title } = req.body;

    if (!title) {
      throw new ApiError(400, 'Title is required', 'MISSING_TITLE');
    }

    if (title.length > 255) {
      throw new ApiError(400, 'Title too long (max 255 characters)', 'TITLE_TOO_LONG');
    }

    // Verify session ownership
    const { data: session, error: fetchError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !session) {
      throw new ApiError(404, 'Session not found', 'NOT_FOUND');
    }

    // Update session
    const { data: updated, error } = await supabaseAdmin
      .from('sessions')
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      throw new ApiError(500, 'Failed to update session', 'UPDATE_ERROR');
    }

    logger.info({ userId: user.id, sessionId, title }, 'Session updated');

    res.status(200).json(updated);
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
      action: 'PUT /api/sessions/:sessionId',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update session',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * Delete a session and its messages
 */
router.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { sessionId } = req.params;

    // Verify session ownership
    const { data: session, error: fetchError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !session) {
      throw new ApiError(404, 'Session not found', 'NOT_FOUND');
    }

    // Delete session (cascades to messages via FK)
    const { error: deleteError } = await supabaseAdmin
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteError) {
      throw new ApiError(500, 'Failed to delete session', 'DELETE_ERROR');
    }

    logger.info({ userId: user.id, sessionId }, 'Session deleted');

    res.status(200).json({ message: 'Session deleted successfully' });
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
      action: 'DELETE /api/sessions/:sessionId',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete session',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
