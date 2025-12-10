# Frontend - SaaS Boilerplate

React 19 + TypeScript frontend with MUI v6 styling, React Router v7 Framework Mode (SSR), and Supabase cookie-based authentication.

## Tech Stack

- **React 19** with TypeScript
- **React Router v7** Framework Mode (SSR with Node.js server)
- **MUI v6** (Material-UI) for styling
- **@supabase/ssr** for cookie-based authentication
- **Vite** for development and building

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- Backend server running on port 3001

### Installation

From the monorepo root:

```bash
npm install
```

### Environment Variables

Create a `.env` file in `packages/frontend/`:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=http://localhost:3001
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
```

### Development

```bash
# From monorepo root
npm run dev:frontend

# Or from packages/frontend
npm run dev
```

The app runs on `http://localhost:5173` by default.

### Build

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

## Project Structure

```
packages/frontend/
├── app/
│   ├── api/                    # API client modules
│   │   ├── client.ts           # Fetch wrapper with credentials
│   │   ├── auth.api.ts         # Auth endpoints
│   │   ├── profile.api.ts      # Profile CRUD
│   │   ├── membership.api.ts   # Tiers, features, usage
│   │   ├── billing.api.ts      # Stripe checkout/portal
│   │   └── admin.api.ts        # Admin operations
│   ├── components/
│   │   ├── auth/               # ProtectedRoute, TierRoute, AdminRoute
│   │   └── layout/             # Header, Footer
│   ├── contexts/
│   │   └── AuthContext.tsx     # Auth state management
│   ├── lib/
│   │   ├── supabase.client.ts  # Browser Supabase client
│   │   └── supabase.server.ts  # Server Supabase client (SSR)
│   ├── routes/                 # File-based routing
│   │   ├── _index.tsx          # Homepage
│   │   ├── pricing.tsx         # Pricing page
│   │   ├── auth.login.tsx      # Login
│   │   ├── auth.register.tsx   # Registration
│   │   ├── dashboard.tsx       # Dashboard layout (protected)
│   │   ├── dashboard._index.tsx
│   │   ├── dashboard.profile.tsx
│   │   ├── dashboard.membership.tsx
│   │   ├── dashboard.billing.tsx
│   │   └── admin.tsx           # Admin layout
│   ├── theme/
│   │   └── index.ts            # MUI theme configuration
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   └── root.tsx                # App root with providers
├── public/                     # Static assets
├── .react-router/              # Auto-generated route types (gitignored)
├── react-router.config.ts      # React Router configuration
├── vite.config.ts
└── tsconfig.json
```

## Key Features

### Authentication

- Email/password authentication via Supabase
- Cookie-based sessions using `@supabase/ssr`
- Protected routes with automatic redirect
- Auth context with `useAuth()` hook

```typescript
const { user, signIn, signUp, signOut, isAuthenticated } = useAuth();
```

### Route Protection

```typescript
// Requires authentication
<ProtectedRoute>
  <DashboardContent />
</ProtectedRoute>

// Requires specific tier
<TierRoute allowedTiers={['premium', 'pro']}>
  <PremiumContent />
</TierRoute>

// Requires admin role
<AdminRoute>
  <AdminContent />
</AdminRoute>
```

### API Client

All API calls include credentials for cookie auth:

```typescript
import * as membershipApi from '~/api/membership.api';

const response = await membershipApi.getMembership();
if (response.success) {
  console.log(response.data);
}
```

### MUI Theme

Custom theme with:

- Primary color: `#2563eb` (blue)
- Inter font family
- Responsive breakpoints
- Light mode (dark mode ready)

## Routes

| Path                    | Description           | Protection    |
| ----------------------- | --------------------- | ------------- |
| `/`                     | Homepage              | Public        |
| `/pricing`              | Pricing page          | Public        |
| `/contact`              | Contact form          | Public        |
| `/auth/login`           | Login                 | Public        |
| `/auth/register`        | Registration          | Public        |
| `/auth/forgot-password` | Password reset        | Public        |
| `/auth/logout`          | Logout                | Public        |
| `/dashboard`            | Dashboard home        | Authenticated |
| `/dashboard/profile`    | Profile settings      | Authenticated |
| `/dashboard/membership` | Membership management | Authenticated |
| `/dashboard/billing`    | Billing & payments    | Authenticated |
| `/checkout`             | Stripe checkout       | Authenticated |
| `/admin`                | Admin dashboard       | Admin role    |

## API Integration

The frontend connects to the backend API at `VITE_BACKEND_URL`. Key endpoints:

- **Auth**: `/api/auth/*` - Password reset
- **Profile**: `/api/profile` - User profile CRUD
- **Membership**: `/api/membership/*` - Tiers, features, trial, usage
- **Billing**: `/api/billing/*` - Stripe checkout/portal
- **Contact**: `/api/contact` - Contact form submission (public, rate-limited)

## Development Notes

### React Router v7 Framework Mode

This project uses React Router v7 in Framework Mode (similar to Remix):

- File-based routing in `app/routes/`
- SSR with Node.js server
- Type-safe routes via `react-router typegen`
- Loaders and actions for data fetching

### Generated Types

The `.react-router/` folder contains auto-generated TypeScript types. It's created by `react-router typegen` and should be in `.gitignore`.

### MUI Grid v6

Uses `Grid2` component (imported as `Grid`):

```typescript
import { Grid2 as Grid } from '@mui/material';

<Grid container spacing={3}>
  <Grid size={{ xs: 12, md: 6 }}>Content</Grid>
</Grid>
```

## Scripts

| Script              | Description                  |
| ------------------- | ---------------------------- |
| `npm run dev`       | Start development server     |
| `npm run build`     | Build for production         |
| `npm run start`     | Start production server      |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint`      | Run ESLint                   |
