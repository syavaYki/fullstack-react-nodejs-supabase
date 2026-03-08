/** @file date.utils.test.ts @description Tests for date utility functions. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getEndOfDay,
  getEndOfMonth,
  isExpired,
  addDays,
  toISOString,
  parseDate,
} from '../utils/date.utils.js';

describe('Date Utils', () => {
  describe('getEndOfDay', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return 23:59:59.999 UTC of the current day', () => {
      vi.setSystemTime(new Date('2024-06-15T10:30:00Z'));
      const result = getEndOfDay();
      expect(result.toISOString()).toBe('2024-06-15T23:59:59.999Z');
    });

    it('should handle midnight exactly', () => {
      vi.setSystemTime(new Date('2024-06-15T00:00:00.000Z'));
      const result = getEndOfDay();
      expect(result.toISOString()).toBe('2024-06-15T23:59:59.999Z');
    });

    it('should handle end of day boundary', () => {
      vi.setSystemTime(new Date('2024-06-15T23:59:59.998Z'));
      const result = getEndOfDay();
      expect(result.toISOString()).toBe('2024-06-15T23:59:59.999Z');
    });

    it('should handle first day of year', () => {
      vi.setSystemTime(new Date('2024-01-01T05:00:00Z'));
      const result = getEndOfDay();
      expect(result.toISOString()).toBe('2024-01-01T23:59:59.999Z');
    });

    it('should handle last day of year', () => {
      vi.setSystemTime(new Date('2024-12-31T12:00:00Z'));
      const result = getEndOfDay();
      expect(result.toISOString()).toBe('2024-12-31T23:59:59.999Z');
    });

    it('should handle leap day', () => {
      vi.setSystemTime(new Date('2024-02-29T08:00:00Z'));
      const result = getEndOfDay();
      expect(result.toISOString()).toBe('2024-02-29T23:59:59.999Z');
    });
  });

  describe('getEndOfMonth', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return last day of a 30-day month', () => {
      vi.setSystemTime(new Date('2024-06-10T12:00:00Z'));
      const result = getEndOfMonth();
      expect(result.toISOString()).toBe('2024-06-30T23:59:59.999Z');
    });

    it('should return last day of a 31-day month', () => {
      vi.setSystemTime(new Date('2024-07-15T12:00:00Z'));
      const result = getEndOfMonth();
      expect(result.toISOString()).toBe('2024-07-31T23:59:59.999Z');
    });

    it('should handle February in a leap year', () => {
      vi.setSystemTime(new Date('2024-02-10T12:00:00Z'));
      const result = getEndOfMonth();
      expect(result.toISOString()).toBe('2024-02-29T23:59:59.999Z');
    });

    it('should handle February in a non-leap year', () => {
      vi.setSystemTime(new Date('2023-02-10T12:00:00Z'));
      const result = getEndOfMonth();
      expect(result.toISOString()).toBe('2023-02-28T23:59:59.999Z');
    });

    it('should handle December to January boundary', () => {
      vi.setSystemTime(new Date('2024-12-15T12:00:00Z'));
      const result = getEndOfMonth();
      // getUTCMonth() + 1 = 13, day 0 => last day of month 12 (December)
      expect(result.toISOString()).toBe('2024-12-31T23:59:59.999Z');
    });

    it('should handle first day of the month', () => {
      vi.setSystemTime(new Date('2024-03-01T00:00:00Z'));
      const result = getEndOfMonth();
      expect(result.toISOString()).toBe('2024-03-31T23:59:59.999Z');
    });

    it('should handle last day of the month', () => {
      vi.setSystemTime(new Date('2024-04-30T23:59:59Z'));
      const result = getEndOfMonth();
      expect(result.toISOString()).toBe('2024-04-30T23:59:59.999Z');
    });
  });

  describe('isExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return false for null', () => {
      expect(isExpired(null)).toBe(false);
    });

    it('should return true for a past date string', () => {
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
      expect(isExpired('2024-06-14T12:00:00Z')).toBe(true);
    });

    it('should return false for a future date string', () => {
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
      expect(isExpired('2024-06-16T12:00:00Z')).toBe(false);
    });

    it('should return true for a past Date object', () => {
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
      expect(isExpired(new Date('2024-06-14T00:00:00Z'))).toBe(true);
    });

    it('should return false for a future Date object', () => {
      vi.setSystemTime(new Date('2024-06-15T12:00:00Z'));
      expect(isExpired(new Date('2024-06-16T00:00:00Z'))).toBe(false);
    });

    it('should return false when date is exactly now (not strictly less than)', () => {
      const now = new Date('2024-06-15T12:00:00.000Z');
      vi.setSystemTime(now);
      // new Date(date) < new Date() — both resolve to same ms, so not expired
      expect(isExpired('2024-06-15T12:00:00.000Z')).toBe(false);
    });

    it('should return true for a date one millisecond in the past', () => {
      vi.setSystemTime(new Date('2024-06-15T12:00:00.001Z'));
      expect(isExpired('2024-06-15T12:00:00.000Z')).toBe(true);
    });
  });

  describe('addDays', () => {
    it('should add positive days', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const result = addDays(date, 5);
      expect(result.toISOString()).toBe('2024-06-20T12:00:00.000Z');
    });

    it('should subtract days with negative value', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const result = addDays(date, -3);
      expect(result.toISOString()).toBe('2024-06-12T12:00:00.000Z');
    });

    it('should handle adding zero days', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const result = addDays(date, 0);
      expect(result.toISOString()).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should not mutate the original date', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      const originalTime = date.getTime();
      addDays(date, 10);
      expect(date.getTime()).toBe(originalTime);
    });

    it('should cross month boundaries', () => {
      const date = new Date('2024-06-28T12:00:00Z');
      const result = addDays(date, 5);
      expect(result.toISOString()).toBe('2024-07-03T12:00:00.000Z');
    });

    it('should cross year boundaries', () => {
      const date = new Date('2024-12-30T12:00:00Z');
      const result = addDays(date, 5);
      expect(result.toISOString()).toBe('2025-01-04T12:00:00.000Z');
    });

    it('should handle leap year boundary', () => {
      const date = new Date('2024-02-28T12:00:00Z');
      const result = addDays(date, 1);
      expect(result.toISOString()).toBe('2024-02-29T12:00:00.000Z');
    });

    it('should handle non-leap year February boundary', () => {
      const date = new Date('2023-02-28T12:00:00Z');
      const result = addDays(date, 1);
      expect(result.toISOString()).toBe('2023-03-01T12:00:00.000Z');
    });
  });

  describe('toISOString', () => {
    it('should return null for null input', () => {
      expect(toISOString(null)).toBeNull();
    });

    it('should convert a Date object to ISO string', () => {
      const date = new Date('2024-06-15T12:00:00Z');
      expect(toISOString(date)).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should convert a date string to ISO string', () => {
      expect(toISOString('2024-06-15T12:00:00Z')).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should handle date-only string', () => {
      const result = toISOString('2024-06-15');
      expect(result).toBe('2024-06-15T00:00:00.000Z');
    });

    it('should handle Date at epoch', () => {
      const date = new Date(0);
      expect(toISOString(date)).toBe('1970-01-01T00:00:00.000Z');
    });
  });

  describe('parseDate', () => {
    it('should return null for null input', () => {
      expect(parseDate(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseDate(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseDate('')).toBeNull();
    });

    it('should return null for invalid date string', () => {
      expect(parseDate('not-a-date')).toBeNull();
    });

    it('should return null for another invalid format', () => {
      expect(parseDate('abc123')).toBeNull();
    });

    it('should parse a valid ISO string', () => {
      const result = parseDate('2024-06-15T12:00:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe('2024-06-15T12:00:00.000Z');
    });

    it('should parse a date-only string', () => {
      const result = parseDate('2024-06-15');
      expect(result).toBeInstanceOf(Date);
      expect(result!.toISOString()).toBe('2024-06-15T00:00:00.000Z');
    });

    it('should parse a date with time', () => {
      const result = parseDate('2024-06-15T18:30:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getUTCHours()).toBe(18);
      expect(result!.getUTCMinutes()).toBe(30);
    });
  });
});
