import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Pino logger instance with pretty-print in development
 * Structured JSON logging in production
 */
export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            levelFirst: true,
            singleLine: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  }
);

/**
 * Request logger middleware for Express
 */
export function requestLogger() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userId: req.user?.id || 'anonymous',
        },
        `${req.method} ${req.path} - ${res.statusCode}`
      );
    });

    next();
  };
}

/**
 * Error logger - captures detailed error information
 */
export function logError(
  error: Error,
  context: {
    userId?: string;
    action: string;
    [key: string]: any;
  }
) {
  logger.error(
    {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    },
    `Error in ${context.action}`
  );
}

/**
 * Info logger - captures important business events
 */
export function logInfo(
  action: string,
  data: {
    userId?: string;
    [key: string]: any;
  }
) {
  logger.info(data, action);
}

/**
 * Warn logger - potential issues
 */
export function logWarn(
  action: string,
  data: {
    userId?: string;
    [key: string]: any;
  }
) {
  logger.warn(data, action);
}

/**
 * Debug logger - detailed development information
 */
export function logDebug(
  action: string,
  data: {
    [key: string]: any;
  }
) {
  if (isDevelopment) {
    logger.debug(data, action);
  }
}
