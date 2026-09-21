import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import { logger, requestLogger, logError } from './logger';
import { initializeSupabase } from './config/supabase';
import { ApiError, ErrorResponse } from './types/index';

// Import routes
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import sessionRoutes from './routes/sessions';
import messageRoutes from './routes/messages';
import documentRoutes from './routes/documents';

// Environment variables
const PORT = parseInt(process.env.PORT || '5000', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * Initialize Express application
 */
const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 3600,
  })
);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging middleware
app.use(requestLogger());

// ==========================================
// HEALTH CHECK ROUTE
// ==========================================

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// ==========================================
// API ROUTES
// ==========================================

// Authentication routes
app.use('/api/auth', authRoutes);

// Project routes
app.use('/api/projects', projectRoutes);

// Session routes
app.use('/api/sessions', sessionRoutes);

// Message routes (chat)
app.use('/api/messages', messageRoutes);

// Document routes (uploads)
app.use('/api/documents', documentRoutes);

// ==========================================
// API DOCUMENTATION ROUTE
// ==========================================

app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'SocraticAI Backend API',
    version: '1.0.0',
    documentation: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me',
      },
      projects: {
        list: 'GET /api/projects',
        create: 'POST /api/projects',
        get: 'GET /api/projects/:projectId',
        update: 'PUT /api/projects/:projectId',
        delete: 'DELETE /api/projects/:projectId',
      },
      sessions: {
        list: 'GET /api/sessions',
        create: 'POST /api/sessions',
        get: 'GET /api/sessions/:sessionId',
        update: 'PUT /api/sessions/:sessionId',
        delete: 'DELETE /api/sessions/:sessionId',
        messages: 'GET /api/sessions/:sessionId/messages',
      },
      messages: {
        list: 'GET /api/messages/session/:sessionId',
        create: 'POST /api/messages',
        stream: 'POST /api/messages/:messageId/stream',
      },
      documents: {
        upload: 'POST /api/documents/upload',
        list: 'GET /api/documents',
        get: 'GET /api/documents/:documentId',
        delete: 'DELETE /api/documents/:documentId',
      },
    },
    socratic_modalities: [
      'bias_blueprint',
      'devil_advocate',
      'socratic_auditor',
      'source_scrutiny',
    ],
  });
});

// ==========================================
// 404 HANDLER
// ==========================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
    },
  });
});

// ==========================================
// GLOBAL ERROR HANDLER
// ==========================================

app.use((err: Error | ApiError, req: Request, res: Response, next: NextFunction) => {
  // Handle ApiError instances
  if (err instanceof ApiError) {
    logError(err, {
      action: `${req.method} ${req.path}`,
      statusCode: err.statusCode,
      code: err.code,
    });

    return void res.status(err.statusCode).json({
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message,
        statusCode: err.statusCode,
        timestamp: new Date().toISOString(),
      },
    } as ErrorResponse);
  }

  // Handle unexpected errors
  logError(err, {
    action: `${req.method} ${req.path}`,
    userId: (req as any).user?.id,
    statusCode: 500,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred'
        : err.message,
      statusCode: 500,
      timestamp: new Date().toISOString(),
    },
  } as ErrorResponse);
});

// ==========================================
// SERVER STARTUP
// ==========================================

async function startServer() {
  try {
    logger.info(
      {
        environment: process.env.NODE_ENV,
        port: PORT,
        frontend: FRONTEND_URL,
      },
      'Starting SocraticAI Backend'
    );

    // Initialize Supabase
    await initializeSupabase();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(
        {
          port: PORT,
          frontend: FRONTEND_URL,
          environment: process.env.NODE_ENV,
          apiDocs: `http://localhost:${PORT}/api`,
        },
        `✓ Server running on http://localhost:${PORT}`
      );

      logger.info(
        {
          health: `http://localhost:${PORT}/health`,
          docs: `http://localhost:${PORT}/api`,
        },
        'Available endpoints'
      );
    });
  } catch (error) {
    if (error instanceof Error) {
      logError(error, {
        action: 'startServer',
      });
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection');
});

// Start the server
startServer();

export default app;
