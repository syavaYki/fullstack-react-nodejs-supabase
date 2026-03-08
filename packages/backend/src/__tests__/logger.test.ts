/**
 * @file logger.test.ts
 * @description Tests for the logger utility — covers shouldLog, formatLog, formatError,
 * and all logger methods (debug, info, warn, error, logError).
 *
 * Pattern: vi.hoisted() + vi.mock() for module mocking.
 * Mocks: env from config/env to control NODE_ENV and LOG_LEVEL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Hoisted mocks — available inside vi.mock factories
// ============================================

const mocks = vi.hoisted(() => ({
  env: {
    NODE_ENV: 'test',
    LOG_LEVEL: '',
  },
}));

vi.mock('../config/env.ts', () => ({
  env: mocks.env,
}));

// ============================================
// Import the module under test (after mocks)
// ============================================

import { logger } from '../utils/logger.js';

// ============================================
// Tests
// ============================================

describe('logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset to defaults
    mocks.env.NODE_ENV = 'test';
    mocks.env.LOG_LEVEL = '';
  });

  // ------------------------------------------
  // shouldLog behavior (tested via logger methods)
  // ------------------------------------------

  describe('shouldLog', () => {
    it('should log debug when NODE_ENV is test (configuredLevel defaults to debug)', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      logger.debug('AUTH', 'debug message');

      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it('should log info when NODE_ENV is test', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      logger.info('SYSTEM', 'info message');

      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it('should log warn when NODE_ENV is production (configuredLevel defaults to warn)', () => {
      mocks.env.NODE_ENV = 'production';
      mocks.env.LOG_LEVEL = '';

      logger.warn('HTTP', 'warning message');

      expect(console.warn).toHaveBeenCalledTimes(1);
    });

    it('should NOT log debug when NODE_ENV is production', () => {
      mocks.env.NODE_ENV = 'production';
      mocks.env.LOG_LEVEL = '';

      logger.debug('AUTH', 'debug message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should NOT log info when NODE_ENV is production', () => {
      mocks.env.NODE_ENV = 'production';
      mocks.env.LOG_LEVEL = '';

      logger.info('DB', 'info message');

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should respect LOG_LEVEL override: error suppresses info and warn', () => {
      mocks.env.LOG_LEVEL = 'error';

      logger.info('SYSTEM', 'should be suppressed');
      logger.warn('SYSTEM', 'should be suppressed');

      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
    });

    it('should log error when LOG_LEVEL is error', () => {
      mocks.env.LOG_LEVEL = 'error';

      logger.error('DB', 'error message');

      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('should respect LOG_LEVEL override: warn allows warn and error', () => {
      mocks.env.LOG_LEVEL = 'warn';

      logger.warn('HTTP', 'warning');
      logger.error('HTTP', 'error');

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });
  });

  // ------------------------------------------
  // formatLog behavior (tested via logger output)
  // ------------------------------------------

  describe('formatLog', () => {
    it('should include timestamp in development mode', () => {
      mocks.env.NODE_ENV = 'development';
      mocks.env.LOG_LEVEL = '';

      logger.info('AUTH', 'dev message');

      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      // Timestamp format: [YYYY-MM-DDTHH:mm:ss.sssZ]
      expect(output).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z\] /);
    });

    it('should omit timestamp in non-development mode', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      logger.info('AUTH', 'test message');

      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      // Should NOT start with a timestamp like [2026-03-06T...]
      expect(output).not.toMatch(/^\[\d{4}-\d{2}-\d{2}T/);
      // Should start directly with [LEVEL]
      expect(output).toMatch(/^\[INFO\]/);
    });

    it('should include data as JSON when provided', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      logger.info('DB', 'with data', { userId: 'abc', count: 5 });

      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('{"userId":"abc","count":5}');
    });

    it('should omit data when not provided', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      logger.info('SYSTEM', 'no data');

      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toBe('[INFO] [SYSTEM] no data');
    });

    it('should format the log string with level and category', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      logger.warn('STRIPE', 'payment issue');

      const output = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toBe('[WARN] [STRIPE] payment issue');
    });
  });

  // ------------------------------------------
  // formatError behavior (tested via logError)
  // ------------------------------------------

  describe('formatError (via logError)', () => {
    it('should format Error objects with message and name', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      const err = new TypeError('something broke');
      logger.logError('DB', 'operation failed', err);

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('"message":"something broke"');
      expect(output).toContain('"name":"TypeError"');
    });

    it('should include stack in development mode', () => {
      mocks.env.NODE_ENV = 'development';
      mocks.env.LOG_LEVEL = '';

      const err = new Error('dev error');
      logger.logError('SYSTEM', 'caught error', err);

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('"stack"');
    });

    it('should NOT include stack in production mode', () => {
      mocks.env.NODE_ENV = 'production';
      mocks.env.LOG_LEVEL = '';

      const err = new Error('prod error');
      logger.logError('SYSTEM', 'caught error', err);

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).not.toContain('"stack"');
    });

    it('should format non-Error values as string message', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      logger.logError('AUTH', 'unexpected', 'string error');

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('"message":"string error"');
    });

    it('should handle numeric non-Error values', () => {
      mocks.env.NODE_ENV = 'test';
      mocks.env.LOG_LEVEL = '';

      logger.logError('SYSTEM', 'number thrown', 42);

      const output = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(output).toContain('"message":"42"');
    });
  });

  // ------------------------------------------
  // logger methods routing
  // ------------------------------------------

  describe('logger methods', () => {
    it('debug should use console.log', () => {
      logger.debug('USAGE', 'debug test');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });

    it('info should use console.log', () => {
      logger.info('CONTACT', 'info test');

      expect(console.log).toHaveBeenCalledTimes(1);
    });

    it('warn should use console.warn', () => {
      logger.warn('MEMBERSHIP', 'warn test');

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.log).not.toHaveBeenCalled();
    });

    it('error should use console.error', () => {
      logger.error('DB', 'error test');

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.log).not.toHaveBeenCalled();
    });
  });
});
