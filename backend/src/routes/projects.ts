import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger, logError } from '../logger';
import { ApiError, CreateProjectRequest, AuthenticatedRequest } from '../types/index';
import authMiddleware from '../middleware/auth';
import { isSuperAdmin } from '../utils/roles';

const router = Router();

// Protect all routes with authentication
router.use(authMiddleware);

/**
 * GET /api/projects
 * List all projects for current user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { limit = 50, offset = 0 } = req.query;

    logger.debug({ userId: user.id, role: user.role }, 'Fetching projects');

    let query = supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact' })
      .is('archived_at', null) // Exclude archived
      .order('updated_at', { ascending: false });

    if (!isSuperAdmin(user.role)) {
      query = query.eq('user_id', user.id);
    }

    const { data: projects, error, count } = await query.range(
      parseInt(offset as string),
      parseInt(offset as string) + parseInt(limit as string) - 1
    );

    if (error) {
      throw new ApiError(500, 'Failed to fetch projects', 'FETCH_ERROR');
    }

    res.status(200).json({
      data: projects || [],
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
      action: 'GET /api/projects',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch projects',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { name, description }: CreateProjectRequest = req.body;

    if (!name) {
      throw new ApiError(400, 'Project name is required', 'MISSING_NAME');
    }

    if (name.length > 255) {
      throw new ApiError(400, 'Project name too long (max 255 characters)', 'NAME_TOO_LONG');
    }

    logger.debug({ userId: user.id, name }, 'Creating project');

    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, 'Failed to create project', 'CREATE_ERROR');
    }

    logger.info({ userId: user.id, projectId: project.id, name }, 'Project created');

    res.status(201).json(project);
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
      action: 'POST /api/projects',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create project',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/projects/:projectId
 * Get a specific project
 */
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { projectId } = req.params;

    const { data: project, error } = await (() => {
      let q = supabaseAdmin.from('projects').select('*').eq('id', projectId);
      if (!isSuperAdmin(user.role)) {
        q = q.eq('user_id', user.id);
      }
      return q.single();
    })();

    if (error || !project) {
      throw new ApiError(404, 'Project not found', 'NOT_FOUND');
    }

    res.status(200).json(project);
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
        message: 'Failed to fetch project',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * PUT /api/projects/:projectId
 * Update a project
 */
router.put('/:projectId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { projectId } = req.params;
    const { name, description }: CreateProjectRequest = req.body;

    // Verify project ownership
    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !project) {
      throw new ApiError(404, 'Project not found', 'NOT_FOUND');
    }

    // Update project
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    updates.updated_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (updateError) {
      throw new ApiError(500, 'Failed to update project', 'UPDATE_ERROR');
    }

    logger.info({ userId: user.id, projectId, name }, 'Project updated');

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
      action: 'PUT /api/projects/:projectId',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update project',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * DELETE /api/projects/:projectId
 * Delete/archive a project
 */
router.delete('/:projectId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { projectId } = req.params;

    // Verify project ownership
    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !project) {
      throw new ApiError(404, 'Project not found', 'NOT_FOUND');
    }

    // Archive project (soft delete)
    const { error: deleteError } = await supabaseAdmin
      .from('projects')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', projectId);

    if (deleteError) {
      throw new ApiError(500, 'Failed to delete project', 'DELETE_ERROR');
    }

    logger.info({ userId: user.id, projectId }, 'Project deleted');

    res.status(200).json({ message: 'Project deleted successfully' });
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
      action: 'DELETE /api/projects/:projectId',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete project',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
