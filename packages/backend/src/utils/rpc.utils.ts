import { supabaseAdmin } from '../config/supabase.js';
import { logger } from './logger.js';

/** Custom error for RPC failures */
export class RpcError extends Error {
  constructor(
    message: string,
    public code: string,
    public functionName: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

/**
 * Call a Supabase RPC function and return the raw data.
 * Throws RpcError on failure.
 */
export async function callRpc<T>(
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(functionName, params);

  if (error) {
    logger.error('DB', `RPC ${functionName} failed`, { error: error.message });
    throw new RpcError(error.message, error.code || 'RPC_ERROR', functionName, error.details);
  }

  return data as T;
}

/** Call RPC and return the first result, or null */
export async function callRpcSingle<T>(
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const data = await callRpc<T[]>(functionName, params);
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

/** Call RPC and return an array (guaranteed) */
export async function callRpcMany<T>(
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const data = await callRpc<T[]>(functionName, params);
  return Array.isArray(data) ? data : [];
}
