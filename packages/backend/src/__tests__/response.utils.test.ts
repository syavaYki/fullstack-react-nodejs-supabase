/** @file response.utils.test.ts @description Tests for response utility functions. */

import { describe, it, expect } from 'vitest';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  messageResponse,
  createdResponse,
  deletedResponse,
} from '../utils/response.utils.js';

describe('Response Utils', () => {
  describe('successResponse', () => {
    it('should return success format with data', () => {
      const result = successResponse({ id: 1 });
      expect(result).toEqual({ success: true, data: { id: 1 } });
    });

    it('should include optional message', () => {
      const result = successResponse({ id: 1 }, 'Created');
      expect(result).toEqual({ success: true, data: { id: 1 }, message: 'Created' });
    });

    it('should handle null data', () => {
      const result = successResponse(null);
      expect(result).toEqual({ success: true, data: null });
    });

    it('should not include message key when message is undefined', () => {
      const result = successResponse('data');
      expect(result).not.toHaveProperty('message');
    });

    it('should not include message key when message is empty string', () => {
      const result = successResponse('data', '');
      expect(result).not.toHaveProperty('message');
    });

    it('should handle array data', () => {
      const result = successResponse([1, 2, 3]);
      expect(result).toEqual({ success: true, data: [1, 2, 3] });
    });
  });

  describe('errorResponse', () => {
    it('should return error format', () => {
      const result = errorResponse('Not found');
      expect(result).toEqual({ success: false, error: 'Not found' });
    });

    it('should include optional details', () => {
      const result = errorResponse('Validation failed', { field: 'email' });
      expect(result).toEqual({
        success: false,
        error: 'Validation failed',
        details: { field: 'email' },
      });
    });

    it('should not include details key when details is undefined', () => {
      const result = errorResponse('Error');
      expect(result).not.toHaveProperty('details');
    });

    it('should handle complex details object', () => {
      const details = { fields: { email: 'required', name: 'too short' }, code: 422 };
      const result = errorResponse('Validation', details);
      expect(result.details).toEqual(details);
    });
  });

  describe('paginatedResponse', () => {
    it('should return paginated format with data and pagination', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = { page: 1, limit: 20, total: 50, totalPages: 3 };
      const result = paginatedResponse(data, pagination);
      expect(result).toEqual({
        success: true,
        data,
        pagination,
      });
    });

    it('should include optional message', () => {
      const data = [{ id: 1 }];
      const pagination = { page: 2, limit: 10, total: 15, totalPages: 2 };
      const result = paginatedResponse(data, pagination, 'Items fetched');
      expect(result).toEqual({
        success: true,
        data,
        pagination,
        message: 'Items fetched',
      });
    });

    it('should not include message key when message is undefined', () => {
      const result = paginatedResponse([], { page: 1, limit: 10, total: 0, totalPages: 0 });
      expect(result).not.toHaveProperty('message');
    });

    it('should not include message key when message is empty string', () => {
      const result = paginatedResponse([], { page: 1, limit: 10, total: 0, totalPages: 0 }, '');
      expect(result).not.toHaveProperty('message');
    });

    it('should handle empty data array', () => {
      const pagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
      const result = paginatedResponse([], pagination);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it('should have success as true literal', () => {
      const result = paginatedResponse([], { page: 1, limit: 10, total: 0, totalPages: 0 });
      expect(result.success).toBe(true);
    });
  });

  describe('messageResponse', () => {
    it('should return success with message', () => {
      const result = messageResponse('Operation completed');
      expect(result).toEqual({ success: true, message: 'Operation completed' });
    });

    it('should not include data key', () => {
      const result = messageResponse('Done');
      expect(result).not.toHaveProperty('data');
    });

    it('should have success as true literal', () => {
      const result = messageResponse('test');
      expect(result.success).toBe(true);
    });

    it('should handle empty string message', () => {
      const result = messageResponse('');
      expect(result).toEqual({ success: true, message: '' });
    });
  });

  describe('createdResponse', () => {
    it('should return success with data', () => {
      const result = createdResponse({ id: 42, name: 'New Item' });
      expect(result).toEqual({ success: true, data: { id: 42, name: 'New Item' } });
    });

    it('should include optional message', () => {
      const result = createdResponse({ id: 1 }, 'Resource created');
      expect(result).toEqual({
        success: true,
        data: { id: 1 },
        message: 'Resource created',
      });
    });

    it('should not include message key when message is undefined', () => {
      const result = createdResponse({ id: 1 });
      expect(result).not.toHaveProperty('message');
    });

    it('should not include message key when message is empty string', () => {
      const result = createdResponse({ id: 1 }, '');
      expect(result).not.toHaveProperty('message');
    });

    it('should handle complex data objects', () => {
      const data = { id: 1, nested: { items: [1, 2, 3] }, active: true };
      const result = createdResponse(data);
      expect(result.data).toEqual(data);
    });

    it('should have success as true literal', () => {
      const result = createdResponse(null);
      expect(result.success).toBe(true);
    });
  });

  describe('deletedResponse', () => {
    it('should return default message when none provided', () => {
      const result = deletedResponse();
      expect(result).toEqual({ success: true, message: 'Resource deleted successfully' });
    });

    it('should use custom message when provided', () => {
      const result = deletedResponse('User removed');
      expect(result).toEqual({ success: true, message: 'User removed' });
    });

    it('should not include data key', () => {
      const result = deletedResponse();
      expect(result).not.toHaveProperty('data');
    });

    it('should have success as true literal', () => {
      const result = deletedResponse();
      expect(result.success).toBe(true);
    });

    it('should handle empty string message (overrides default)', () => {
      const result = deletedResponse('');
      expect(result).toEqual({ success: true, message: '' });
    });
  });
});
