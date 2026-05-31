import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { isApiError, ApiError, ValidationError } from '../src/lib/apiError';

/**
 * Error handling middleware for Express
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', error);

  if (isApiError(error)) {
    res.status(error.statusCode).json(error.toJSON());
    return;
  }

  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    error.errors.forEach((err) => {
      const path = err.path.join('.');
      fieldErrors[path] = err.message;
    });
    const validationError = new ValidationError('Validation failed', fieldErrors);
    res.status(validationError.statusCode).json(validationError.toJSON());
    return;
  }

  if (error instanceof Error) {
    res.status(500).json({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message:
        process.env.NODE_ENV === 'production' ? 'An internal server error occurred' : error.message,
    });
    return;
  }

  res.status(500).json({
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unknown error occurred',
  });
}

/**
 * Request validation middleware factory
 */
export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
