# Deployment Guide

This guide covers deploying the fullstack SaaS application to production.

## Prerequisites

- Node.js 18+ installed
- Supabase project created
- Stripe account configured (optional, for payments)
- Production domain with SSL

## Environment Setup

### 1. Supabase Configuration

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run all migrations in `supabase/migrations/` via the Supabase Dashboard SQL editor
3. Configure authentication providers in Dashboard > Authentication > Providers

### 2. Required Environment Variables

Create a `.env` file in `packages/backend/` with:

```env
# Supabase (from Dashboard > Settings > API)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret

# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend.com
BACKEND_URL=https://your-backend.com

# Stripe (from Stripe Dashboard > Developers > API keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email - Optional
RESEND_API_KEY=re_...
CONTACT_NOTIFICATION_EMAIL=admin@yourdomain.com
```

### 3. Supabase Auth Configuration

Add redirect URLs in Supabase Dashboard > Authentication > URL Configuration:

**Development:**

- `http://localhost:3000`
- `http://localhost:3001/api/auth/callback`

**Production:**

- `https://your-frontend.com`
- `https://your-backend.com/api/auth/callback`

## Build Steps

```bash
# Install all dependencies
npm install

# Build backend
npm run build:backend

# Build frontend
npm run build:frontend
```

## Deployment Options

### Option A: Platform-as-a-Service (Recommended)

**Backend (Railway, Render, Fly.io):**

1. Connect your repository
2. Set root directory to `packages/backend`
3. Set build command: `npm run build`
4. Set start command: `npm run start`
5. Add environment variables

**Frontend (Vercel, Netlify):**

1. Connect your repository
2. Set root directory to `packages/frontend`
3. Set build command: `npm run build`
4. Set output directory: `build`
5. Add environment variables (VITE\_\* prefix for client-side)

### Option B: Docker

```dockerfile
# Backend Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
COPY packages/backend/package*.json ./packages/backend/
RUN npm ci --workspace=@app/backend
COPY packages/backend ./packages/backend
RUN npm run build --workspace=@app/backend
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=@app/backend"]
```

### Option C: Traditional VPS

```bash
# On server
git clone your-repo
cd your-repo
npm ci
npm run build:backend
npm run build:frontend

# Use PM2 for process management
pm2 start packages/backend/dist/index.js --name "api"

# Use nginx to serve frontend and proxy API
```

## Stripe Webhook Setup

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-backend.com/api/billing/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy signing secret to `STRIPE_WEBHOOK_SECRET`

## Health Check

After deployment, verify:

```bash
# Backend health
curl https://your-backend.com/api/health

# Expected response:
# {"success":true,"data":{"status":"healthy","timestamp":"..."}}
```

## Post-Deployment Checklist

- [ ] All environment variables set
- [ ] Supabase migrations applied
- [ ] Supabase redirect URLs configured
- [ ] Stripe webhook endpoint registered
- [ ] CORS configured for production domain
- [ ] SSL/TLS enabled
- [ ] Health check endpoint responding
- [ ] Auth flow working (register, login, OAuth)
- [ ] Stripe checkout flow working (if applicable)

## Monitoring Recommendations

- Use Supabase Dashboard for database metrics
- Configure Stripe Dashboard alerts for failed payments
- Set up error tracking (Sentry, LogRocket)
- Monitor API response times and error rates

## Troubleshooting

### Common Issues

**CORS errors:**

- Verify `FRONTEND_URL` matches your actual frontend domain
- Check the CORS configuration in `packages/backend/src/index.ts`

**Auth callback failures:**

- Ensure redirect URLs are added in Supabase Dashboard
- Check that `FRONTEND_URL` and `BACKEND_URL` are correct

**Stripe webhook 400 errors:**

- Verify webhook secret is correct
- Ensure raw body parsing is enabled for the webhook route
- Check Stripe Dashboard > Webhooks for detailed error logs

**Database connection issues:**

- Verify `SUPABASE_URL` and keys are correct
- Check Supabase project is not paused (free tier pauses after inactivity)
