import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import routes from './routes/index.js';
import { logger } from './utils/logger.js';

const app = express();

// ============================================
// MIDDLEWARE ORDER (matters!)
// ============================================

// 1. Security headers
app.use(helmet());

// 2. CORS
const allowedOrigins = [env.FRONTEND_URL];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Cookie parser (for Supabase SSR auth)
app.use(cookieParser());

// 4. Body parsers
// Stripe webhook needs raw body for signature verification — MUST be before express.json()
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10kb' }));

// 5. Request logging
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 6. API documentation (development only)
if (env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// 7. API routes
app.use('/api', routes);

// 8. Error handling (must be LAST)
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
const PORT = parseInt(env.PORT, 10);

const server = app.listen(PORT, () => {
  const supabaseStatus = env.SUPABASE_URL ? 'configured ✓' : 'not configured ✗';
  const stripeStatus = env.STRIPE_SECRET_KEY ? 'configured ✓' : 'not configured ✗';
  const logLevel = env.LOG_LEVEL ?? 'info';

  // Log startup banner (always shown regardless of log level)
  const localUrl = `http://localhost:${PORT}`;
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 Server running on ${localUrl}
║                                                        ║${
    env.NODE_ENV !== 'production'
      ? `\n║   📚 API Docs: ${localUrl}/api-docs\n║                                                        ║`
      : ''
  }
║   🗄️  Supabase: ${supabaseStatus}
║                                                        ║
║   💳 Stripe:   ${stripeStatus}
║                                                        ║
║   Environment: ${env.NODE_ENV} | Log Level: ${logLevel}
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);
});

// Graceful shutdown — drain in-flight requests before exiting
function gracefulShutdown(signal: string) {
  logger.info('SYSTEM', `${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('SYSTEM', 'All connections closed');
    process.exit(0);
  });
  // Force exit after 10s if connections don't close
  setTimeout(() => {
    logger.warn('SYSTEM', 'Forcing shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('SYSTEM', 'Unhandled promise rejection', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  logger.error('SYSTEM', 'Uncaught exception', { error: error.message, stack: error.stack });
  gracefulShutdown('uncaughtException');
});

export default app;
