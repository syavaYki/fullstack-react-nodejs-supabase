/**
 * @file error.middleware.test.ts
 * @description Tests for error middleware (ApiError, asyncHandler, errorHandler, notFoundHandler).
 */
/* eslint-disable @typescript-eslint/ban-types, @typescript-eslint/no-unused-vars */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError, ZodIssueCode } from 'zod';

// Mock the logger to prevent console output during tests
vi.mock('../utils/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

import {
  ApiError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
} from '../middleware/error.middleware.ts';
import { createMockRequest, createMockResponse, createMockNext } from './mocks/index.ts';

describe('Error Middleware', () => {
  let mockReq: ReturnType<typeof createMockRequest>;
  let mockRes: ReturnType<typeof createMockResponse>;
  let mockNext: ReturnType<typeof createMockNext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('ApiError', () => {
    it('should create error with status code and message', () => {
      const error = new ApiError(400, 'Bad request');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad request');
      expect(error.name).toBe('ApiError');
    });

    it('should support optional details', () => {
      const details = { field: 'email', reason: 'already exists' };
      const error = new ApiError(409, 'Conflict', details);

      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Conflict');
      expect(error.details).toEqual(details);
    });
  });

  describe('asyncHandler', () => {
    it('should catch async errors and pass to next()', async () => {
      const thrownError = new Error('Async failure');
      const handler = asyncHandler(async () => {
        throw thrownError;
      });

      handler(mockReq as any, mockRes as any, mockNext);

      // Wait for the promise rejection to propagate
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(thrownError);
    });

    it('should not call next() when handler succeeds', async () => {
      const handler = asyncHandler(async (_req, res) => {
        res.status(200).json({ success: true });
      });

      handler(mockReq as any, mockRes as any, mockNext);

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('errorHandler', () => {
    it('should format ApiError responses with correct status', () => {
      const error = new ApiError(422, 'Unprocessable entity');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unprocessable entity',
      });
    });

    it('should include details in ApiError response when present', () => {
      const error = new ApiError(400, 'Validation error', { field: 'name' });

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation error',
        details: { field: 'name' },
      });
    });

    it('should return 500 for non-ApiError errors', () => {
      const error = new Error('Something unexpected');

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
      });
    });

    it('should not include stack trace in production (500 response has no details)', () => {
      const error = new Error('Unexpected crash');
      error.stack = 'Error: Unexpected crash\n    at Object.<anonymous> (file.ts:10:5)';

      errorHandler(error, mockReq as any, mockRes as any, mockNext);

      const jsonCall = mockRes.json.mock.calls[0][0];
      expect(jsonCall).not.toHaveProperty('stack');
      expect(jsonCall).not.toHaveProperty('details');
      expect(jsonCall).toEqual({
        success: false,
        error: 'Internal server error',
      });
    });

    it('should handle ZodError as 400 with validation details', () => {
      const zodError = new ZodError([
        {
          code: ZodIssueCode.invalid_type,
          expected: 'string',
          received: 'number',
          path: ['email'],
          message: 'Expected string, received number',
        },
      ]);

      errorHandler(zodError, mockReq as any, mockRes as any, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: [
          {
            field: 'email',
            message: 'Expected string, received number',
          },
        ],
      });
    });
  });

  describe('notFoundHandler', () => {
    it('should return 404 with route not found message', () => {
      notFoundHandler(mockReq as any, mockRes as any);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Route not found',
      });
    });
  });
});
