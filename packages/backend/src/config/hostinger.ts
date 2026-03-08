import nodemailer from 'nodemailer';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export function isHostingerConfigured(): boolean {
  return !!(env.HOSTINGER_SMTP_HOST && env.HOSTINGER_SMTP_USER && env.HOSTINGER_SMTP_PASSWORD);
}

export function getHostingerFromEmail(): string {
  return env.HOSTINGER_FROM_EMAIL || env.HOSTINGER_SMTP_USER;
}

export function getHostingerFromName(): string {
  return env.HOSTINGER_FROM_NAME || 'No Reply';
}

// Singleton transport — created once, reused across requests
let _transport: nodemailer.Transporter | null = null;

export function getHostingerTransport(): nodemailer.Transporter | null {
  if (!isHostingerConfigured()) return null;

  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: env.HOSTINGER_SMTP_HOST,
      port: parseInt(env.HOSTINGER_SMTP_PORT, 10),
      secure: env.HOSTINGER_SMTP_SECURE === 'true', // true = SSL/465, false = TLS/587
      auth: {
        user: env.HOSTINGER_SMTP_USER,
        pass: env.HOSTINGER_SMTP_PASSWORD,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 60_000,
      tls: {
        rejectUnauthorized: false, // Hostinger uses self-signed intermediate certs
      },
    });
  }

  return _transport;
}

export async function verifyHostingerConnection(): Promise<boolean> {
  const transport = getHostingerTransport();
  if (!transport) return false;
  try {
    await transport.verify();
    logger.info('BUG_REPORT', 'Hostinger SMTP connection verified');
    return true;
  } catch (err) {
    logger.warn('BUG_REPORT', 'Hostinger SMTP verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
