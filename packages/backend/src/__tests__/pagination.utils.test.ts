/** @file pagination.utils.test.ts @description Tests for pagination utility functions. */

import { describe, it, expect } from 'vitest';
import {
  normalizePaginationOptions,
  calculateOffset,
  createPaginationMeta,
  paginate,
} from '../utils/pagination.utils.js';

describe('Pagination Utils', () => {
  describe('normalizePaginationOptions', () => {
    it('should return defaults when no options provided', () => {
      const result = normalizePaginationOptions();
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('should return defaults when undefined is passed', () => {
      const result = normalizePaginationOptions(undefined);
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('should return defaults when empty object is passed', () => {
      const result = normalizePaginationOptions({});
      expect(result).toEqual({ page: 1, limit: 20 });
    });

    it('should use provided page and limit', () => {
      const result = normalizePaginationOptions({ page: 3, limit: 50 });
      expect(result).toEqual({ page: 3, limit: 50 });
    });

    it('should clamp page to minimum of 1', () => {
      const result = normalizePaginationOptions({ page: 0 });
      expect(result.page).toBe(1);
    });

    it('should clamp negative page to 1', () => {
      const result = normalizePaginationOptions({ page: -5 });
      expect(result.page).toBe(1);
    });

    it('should clamp limit to maximum of 100', () => {
      const result = normalizePaginationOptions({ limit: 200 });
      expect(result.limit).toBe(100);
    });

    it('should clamp limit to minimum of 1', () => {
      const result = normalizePaginationOptions({ limit: 0 });
      expect(result.limit).toBe(1);
    });

    it('should clamp negative limit to 1', () => {
      const result = normalizePaginationOptions({ limit: -10 });
      expect(result.limit).toBe(1);
    });

    it('should allow limit exactly at MAX_LIMIT (100)', () => {
      const result = normalizePaginationOptions({ limit: 100 });
      expect(result.limit).toBe(100);
    });

    it('should allow limit exactly at 1', () => {
      const result = normalizePaginationOptions({ limit: 1 });
      expect(result.limit).toBe(1);
    });

    it('should use default limit when only page is provided', () => {
      const result = normalizePaginationOptions({ page: 5 });
      expect(result).toEqual({ page: 5, limit: 20 });
    });

    it('should use default page when only limit is provided', () => {
      const result = normalizePaginationOptions({ limit: 10 });
      expect(result).toEqual({ page: 1, limit: 10 });
    });
  });

  describe('calculateOffset', () => {
    it('should return 0 for page 1', () => {
      expect(calculateOffset(1, 20)).toBe(0);
    });

    it('should calculate offset for page 2', () => {
      expect(calculateOffset(2, 20)).toBe(20);
    });

    it('should calculate offset for page 3 with limit 10', () => {
      expect(calculateOffset(3, 10)).toBe(20);
    });

    it('should calculate offset for large page numbers', () => {
      expect(calculateOffset(100, 50)).toBe(4950);
    });

    it('should return 0 for page 1 with any limit', () => {
      expect(calculateOffset(1, 1)).toBe(0);
      expect(calculateOffset(1, 100)).toBe(0);
    });

    it('should handle limit of 1', () => {
      expect(calculateOffset(5, 1)).toBe(4);
    });
  });

  describe('createPaginationMeta', () => {
    it('should create correct meta for single page', () => {
      const result = createPaginationMeta(5, 1, 20);
      expect(result).toEqual({ page: 1, limit: 20, total: 5, totalPages: 1 });
    });

    it('should create correct meta for multiple pages', () => {
      const result = createPaginationMeta(100, 2, 20);
      expect(result).toEqual({ page: 2, limit: 20, total: 100, totalPages: 5 });
    });

    it('should round up totalPages for partial last page', () => {
      const result = createPaginationMeta(21, 1, 20);
      expect(result).toEqual({ page: 1, limit: 20, total: 21, totalPages: 2 });
    });

    it('should handle zero total', () => {
      const result = createPaginationMeta(0, 1, 20);
      expect(result).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
    });

    it('should handle total exactly divisible by limit', () => {
      const result = createPaginationMeta(60, 1, 20);
      expect(result).toEqual({ page: 1, limit: 20, total: 60, totalPages: 3 });
    });

    it('should handle total of 1', () => {
      const result = createPaginationMeta(1, 1, 20);
      expect(result).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('should handle limit of 1', () => {
      const result = createPaginationMeta(5, 1, 1);
      expect(result).toEqual({ page: 1, limit: 1, total: 5, totalPages: 5 });
    });
  });

  describe('paginate', () => {
    it('should return paginated result with default options', () => {
      const data = [1, 2, 3];
      const result = paginate(data, 50);
      expect(result).toEqual({
        data: [1, 2, 3],
        pagination: { page: 1, limit: 20, total: 50, totalPages: 3 },
      });
    });

    it('should return paginated result with custom options', () => {
      const data = ['a', 'b'];
      const result = paginate(data, 100, { page: 3, limit: 10 });
      expect(result).toEqual({
        data: ['a', 'b'],
        pagination: { page: 3, limit: 10, total: 100, totalPages: 10 },
      });
    });

    it('should normalize invalid options', () => {
      const data = [{ id: 1 }];
      const result = paginate(data, 10, { page: -1, limit: 500 });
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(100);
    });

    it('should handle empty data array', () => {
      const result = paginate([], 0);
      expect(result).toEqual({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    });

    it('should preserve data reference', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const result = paginate(data, 2);
      expect(result.data).toBe(data);
    });

    it('should work with generic types', () => {
      interface Item {
        name: string;
        value: number;
      }
      const data: Item[] = [{ name: 'test', value: 42 }];
      const result = paginate<Item>(data, 1, { page: 1, limit: 10 });
      expect(result.data[0].name).toBe('test');
      expect(result.data[0].value).toBe(42);
    });
  });
});
