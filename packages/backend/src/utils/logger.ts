import { env } from '../config/env.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogCategory =
  | 'AUTH'
  | 'DB'
  | 'HTTP'
  | 'STRIPE'
  | 'SYSTEM'
  | 'MEMBERSHIP'
  | 'USAGE'
  | 'CONTACT'
  | 'BUG_REPORT'
  | 'EMAIL';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const configuredLevel: LogLevel =
    (env.LOG_LEVEL as LogLevel) || (env.NODE_ENV === 'production' ? 'warn' : 'debug');
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel];
}

function formatLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: Record<string, unknown>
): string {
  const timestamp = env.NODE_ENV === 'development' ? `[${new Date().toISOString()}] ` : '';
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `${timestamp}[${level.toUpperCase()}] [${category}] ${message}${dataStr}`;
}

function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      ...(env.NODE_ENV === 'development' && { stack: error.stack }),
    };
  }
  return { message: String(error) };
}

export const logger = {
  debug: (category: LogCategory, message: string, data?: Record<string, unknown>): void => {
    if (shouldLog('debug')) console.log(formatLog('debug', category, message, data));
  },

  info: (category: LogCategory, message: string, data?: Record<string, unknown>): void => {
    if (shouldLog('info')) console.log(formatLog('info', category, message, data));
  },

  warn: (category: LogCategory, message: string, data?: Record<string, unknown>): void => {
    if (shouldLog('warn')) console.warn(formatLog('warn', category, message, data));
  },

  error: (category: LogCategory, message: string, data?: Record<string, unknown>): void => {
    if (shouldLog('error')) console.error(formatLog('error', category, message, data));
  },

  logError: (category: LogCategory, message: string, error: unknown): void => {
    logger.error(category, message, formatError(error));
  },
};

export default logger;
