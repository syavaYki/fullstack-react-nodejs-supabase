# Security Configuration Guide

This document outlines the security measures implemented in the application and configuration options.

## Authentication

### JWT Token Validation

All authenticated routes validate JWT tokens via the `authenticate` middleware:

- Tokens are verified using the `JWT_SECRET` from Supabase
- Expired tokens are rejected with 401 status
- User data is attached to `req.user` for downstream handlers

### Cookie-Based Sessions

The application uses `@supabase/ssr` for cookie-based authentication:

- Access tokens stored in HTTP-only cookies
- Automatic token refresh on expiration
- CSRF protection via SameSite cookie attribute

## Rate Limiting

Rate limiting is applied to sensitive endpoints to prevent abuse:

### Configured Limits

| Endpoint                    | Limit       | Window     |
| --------------------------- | ----------- | ---------- |
| `/api/auth/register`        | 5 requests  | 15 minutes |
| `/api/auth/login`           | 10 requests | 15 minutes |
| `/api/auth/forgot-password` | 3 requests  | 15 minutes |
| `/api/contact`              | 5 requests  | 15 minutes |

### Configuration

Rate limiters are defined in `packages/backend/src/middleware/rateLimit.middleware.ts`:

```typescript
export const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many registration attempts...',
});
```

## Input Validation

### Request Size Limits

JSON and URL-encoded payloads are limited to 10KB:

```typescript
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
```

### Schema Validation

Request bodies are validated using Zod schemas before processing:

- Type checking
- Required field validation
- Format validation (email, UUID, etc.)

## CORS Configuration

Cross-Origin Resource Sharing is configured to allow only the frontend origin:

```typescript
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
```

## Security Headers

Helmet.js is used to set secure HTTP headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- Content Security Policy (configurable)

## Database Security

### Row Level Security (RLS)

Supabase RLS policies restrict data access:

- Users can only read/write their own profile
- Users can only access their own membership data
- Admin tables have admin-only policies

### Service Role Usage

The service role key (`SUPABASE_SERVICE_ROLE_KEY`) is used only for:

- Server-side operations that need to bypass RLS
- Webhook handlers processing external events
- Admin operations

## Stripe Security

### Webhook Signature Verification

All Stripe webhooks are verified:

```typescript
stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
```

### Raw Body Parsing

The webhook endpoint uses raw body parsing to enable signature verification:

```typescript
app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), webhookHandler);
```

## Environment Variables

### Sensitive Variables

Never commit these to version control:

- `SUPABASE_SERVICE_ROLE_KEY` - Full database access
- `JWT_SECRET` - Token signing key
- `STRIPE_SECRET_KEY` - Stripe API access
- `STRIPE_WEBHOOK_SECRET` - Webhook verification
- `RESEND_API_KEY` - Email service access

### Production Checklist

- [ ] All secrets stored in environment variables
- [ ] `.env` files in `.gitignore`
- [ ] Different keys for dev/staging/production
- [ ] Keys rotated regularly

## Disabled Features

### Admin Routes

Admin functionality is currently disabled for security:

```typescript
// packages/frontend/app/routes/admin.tsx
export async function loader() {
  throw redirect('/dashboard'); // Admin disabled
}
```

### Test Routes

Test routes are only available in development:

```typescript
if (env.NODE_ENV !== 'production') {
  router.use('/test', testRoutes);
}
```

## Security Best Practices

### For Development

1. Use separate Supabase projects for dev/prod
2. Use Stripe test mode keys for development
3. Never log sensitive data (tokens, passwords)
4. Review code for hardcoded secrets before commits

### For Production

1. Enable HTTPS everywhere
2. Use strong, unique passwords for all services
3. Enable 2FA on Supabase and Stripe dashboards
4. Monitor for suspicious activity
5. Keep dependencies updated
6. Set up alerts for failed login attempts
7. Regular security audits

## Reporting Vulnerabilities

If you discover a security vulnerability, please:

1. Do not open a public issue
2. Email security concerns privately
3. Provide detailed reproduction steps
4. Allow time for a fix before disclosure
