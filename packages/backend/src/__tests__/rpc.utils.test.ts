/** @file rpc.utils.test.ts @description Tests for RPC utility functions and RpcError class. */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  supabaseAdmin: { rpc: vi.fn() },
}));

vi.mock('../config/supabase.ts', () => ({
  supabaseAdmin: mocks.supabaseAdmin,
}));

vi.mock('../utils/logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logError: vi.fn(),
  },
}));

import { callRpc, callRpcSingle, callRpcMany, RpcError } from '../utils/rpc.utils.js';

describe('RPC Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RpcError', () => {
    it('should create an error with correct properties', () => {
      const error = new RpcError('Something failed', 'ERR_001', 'my_function', {
        hint: 'check input',
      });
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(RpcError);
      expect(error.name).toBe('RpcError');
      expect(error.message).toBe('Something failed');
      expect(error.code).toBe('ERR_001');
      expect(error.functionName).toBe('my_function');
      expect(error.details).toEqual({ hint: 'check input' });
    });

    it('should work without details', () => {
      const error = new RpcError('Fail', 'ERR', 'fn');
      expect(error.details).toBeUndefined();
      expect(error.message).toBe('Fail');
      expect(error.code).toBe('ERR');
      expect(error.functionName).toBe('fn');
    });

    it('should have a stack trace', () => {
      const error = new RpcError('test', 'CODE', 'func');
      expect(error.stack).toBeDefined();
    });
  });

  describe('callRpc', () => {
    it('should return data on success', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ id: 1, name: 'test' }],
        error: null,
      });

      const result = await callRpc<{ id: number; name: string }[]>('get_items');
      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('get_items', {});
    });

    it('should pass params to rpc call', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: 'ok', error: null });

      await callRpc('update_item', { id: 5, value: 'new' });
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('update_item', { id: 5, value: 'new' });
    });

    it('should use empty object as default params', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });

      await callRpc('no_params_fn');
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('no_params_fn', {});
    });

    it('should throw RpcError when rpc returns an error', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Function not found', code: '42883', details: 'No such function' },
      });

      await expect(callRpc('missing_fn')).rejects.toThrow(RpcError);
      await expect(callRpc('missing_fn')).rejects.toMatchObject({
        message: 'Function not found',
        code: '42883',
        functionName: 'missing_fn',
        details: 'No such function',
      });
    });

    it('should use RPC_ERROR as default code when error.code is falsy', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Unknown error', code: '', details: null },
      });

      try {
        await callRpc('some_fn');
      } catch (e) {
        expect(e).toBeInstanceOf(RpcError);
        expect((e as RpcError).code).toBe('RPC_ERROR');
      }
    });

    it('should return null data when rpc returns null on success', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({ data: null, error: null });

      const result = await callRpc('void_fn');
      expect(result).toBeNull();
    });
  });

  describe('callRpcSingle', () => {
    it('should return the first item from a non-empty array', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }, { id: 3 }],
        error: null,
      });

      const result = await callRpcSingle<{ id: number }>('get_items');
      expect(result).toEqual({ id: 1 });
    });

    it('should return null for an empty array', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await callRpcSingle<{ id: number }>('get_items');
      expect(result).toBeNull();
    });

    it('should return null when data is not an array', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: 'not-an-array',
        error: null,
      });

      const result = await callRpcSingle<string>('get_scalar');
      expect(result).toBeNull();
    });

    it('should propagate RpcError from callRpc', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'DB error', code: '50000', details: null },
      });

      await expect(callRpcSingle('failing_fn')).rejects.toThrow(RpcError);
    });

    it('should pass params through to callRpc', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ id: 10 }],
        error: null,
      });

      await callRpcSingle('get_by_id', { id: 10 });
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('get_by_id', { id: 10 });
    });
  });

  describe('callRpcMany', () => {
    it('should return the array when data is an array', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        error: null,
      });

      const result = await callRpcMany<{ id: number }>('get_all');
      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('should return an empty array when data is an empty array', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await callRpcMany<{ id: number }>('get_all');
      expect(result).toEqual([]);
    });

    it('should return empty array when data is not an array', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: 'scalar-value',
        error: null,
      });

      const result = await callRpcMany<string>('get_scalar');
      expect(result).toEqual([]);
    });

    it('should return empty array when data is null', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await callRpcMany('null_fn');
      expect(result).toEqual([]);
    });

    it('should propagate RpcError from callRpc', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Timeout', code: '57014', details: null },
      });

      await expect(callRpcMany('slow_fn')).rejects.toThrow(RpcError);
    });

    it('should pass params through to callRpc', async () => {
      mocks.supabaseAdmin.rpc.mockResolvedValue({
        data: [{ id: 1 }],
        error: null,
      });

      await callRpcMany('search', { query: 'test' });
      expect(mocks.supabaseAdmin.rpc).toHaveBeenCalledWith('search', { query: 'test' });
    });
  });
});
