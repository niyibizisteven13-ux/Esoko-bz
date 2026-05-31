/**
 * Custom API Error class for standardized error handling
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  toJSON() {
    return {
      statusCode: this.statusCode,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Validation Error - 400 Bad Request
 */
export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Authentication Error - 401 Unauthorized
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(401, message, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization Error - 403 Forbidden
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(403, message, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Not Found Error - 404
 */
export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Conflict Error - 409
 */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * Rate Limit Error - 429
 */
export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests') {
    super(429, message, 'RATE_LIMIT_EXCEEDED');
    this.name = 'RateLimitError';
  }
}

/**
 * Internal Server Error - 500
 */
export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error', details?: Record<string, unknown>) {
    super(500, message, 'INTERNAL_SERVER_ERROR', details);
    this.name = 'InternalServerError';
  }
}

/**
 * Check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Handle errors and convert to ApiError
 */
export function handleError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Log unexpected errors in production
    if (process.env.NODE_ENV === 'production') {
      console.error('Unexpected error:', error);
    }
    return new InternalServerError(error.message);
  }

  return new InternalServerError('An unknown error occurred');
}
