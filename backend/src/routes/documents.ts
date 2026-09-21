import { Router, Request, Response } from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../config/supabase';
import { logger, logError } from '../logger';
import { ApiError, AuthenticatedRequest } from '../types/index';
import authMiddleware from '../middleware/auth';
import { DocumentService, createDocumentService } from '../services/document.service';
import { isSuperAdmin } from '../utils/roles';

const router = Router();

// Configure multer for file uploads (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown', 'application/json'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// Protect all routes with authentication
router.use(authMiddleware);

const docService = createDocumentService();

/**
 * POST /api/documents/upload
 * Upload a document to a project
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { project_id: projectId } = req.body;

    if (!req.file) {
      throw new ApiError(400, 'No file provided', 'NO_FILE');
    }

    if (!projectId) {
      throw new ApiError(400, 'Project ID is required', 'MISSING_PROJECT_ID');
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      throw new ApiError(404, 'Project not found', 'PROJECT_NOT_FOUND');
    }

    logger.debug(
      {
        userId: user.id,
        projectId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      },
      'Processing document upload'
    );

    // Upload document
    const document = await docService.uploadDocument(
      {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalname: req.file.originalname,
      },
      user.id,
      projectId
    );

    logger.info(
      {
        userId: user.id,
        projectId,
        documentId: document.id,
        fileName: document.filename,
      },
      'Document uploaded successfully'
    );

    // Parse document to get preview
    const content = await docService.parseDocument(document.id, user.id);
    const preview = content.substring(0, 500);

    res.status(201).json({
      document,
      preview,
      parsed: true,
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

    if (error instanceof Error && error.message.includes('Unsupported file type')) {
      return void res.status(400).json({
        error: {
          code: 'UNSUPPORTED_FILE_TYPE',
          message: error.message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        },
      });
    }

    logError(error as Error, {
      action: 'POST /api/documents/upload',
      userId: (req as AuthenticatedRequest).user.id,
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to upload document',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/documents
 * List documents (optionally filtered by project)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { project_id: projectId, limit = 50, offset = 0 } = req.query;

    logger.debug({ userId: user.id, projectId, role: user.role }, 'Fetching documents');

    let query = supabaseAdmin.from('documents').select('*', { count: 'exact' });

    if (!isSuperAdmin(user.role)) {
      query = query.eq('user_id', user.id);
    }

    if (projectId) {
      query = query.eq('project_id', projectId as string);
    }

    const { data: documents, error, count } = await query
      .order('uploaded_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (error) {
      throw new ApiError(500, 'Failed to fetch documents', 'FETCH_ERROR');
    }

    res.status(200).json({
      data: documents || [],
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
      action: 'GET /api/documents',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch documents',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/documents/:documentId
 * Get document details and content
 */
router.get('/:documentId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { documentId } = req.params;

    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (error || !document) {
      throw new ApiError(404, 'Document not found', 'NOT_FOUND');
    }

    // Parse content
    const content = await docService.parseDocument(documentId, user.id);

    res.status(200).json({
      document,
      content,
      content_preview: content.substring(0, 500),
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
      action: 'GET /api/documents/:documentId',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch document',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * DELETE /api/documents/:documentId
 * Delete a document
 */
router.delete('/:documentId', async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { documentId } = req.params;

    logger.debug({ userId: user.id, documentId }, 'Deleting document');

    await docService.deleteDocument(documentId, user.id);

    logger.info({ userId: user.id, documentId }, 'Document deleted');

    res.status(200).json({ message: 'Document deleted successfully' });
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
      action: 'DELETE /api/documents/:documentId',
    });

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete document',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router;
