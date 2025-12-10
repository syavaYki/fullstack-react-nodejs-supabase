# Frontend Implementation Plan

## Overview

Create a React 19 + TypeScript frontend with MUI styling, React Router v7 Framework Mode (SSR), and Supabase cookie-based authentication for the SaaS boilerplate.

---

## Tech Stack

- **React 19** with TypeScript
- **React Router v7 Framework Mode** (SSR with Node.js server, Remix-style)
- **MUI v6** (Material-UI) for styling
- **@supabase/ssr** for cookie-based auth
- **React Router Context** for client state management
- **React Router Loaders/Actions** for SSR data fetching
- **@stripe/stripe-js** for checkout

## Design Direction

- **Modern, clean, minimalistic** aesthetic
- Neutral color palette with subtle accents
- Primary: #2563eb (Modern blue)
- Dark mode: #1e293b background
- Clean typography with good whitespace
- Subtle shadows and rounded corners

## Authentication

- **Email/Password only** (no OAuth providers for now)
- Cookie-based session management via @supabase/ssr

---

## Project Structure (React Router v7 Framework Mode)

```text
packages/frontend/
├── app/
│   ├── routes/                 # File-based routing (React Router v7)
│   │   ├── _index.tsx          # Homepage (/)
│   │   ├── _layout.tsx         # Root layout wrapper
│   │   ├── pricing.tsx         # /pricing
│   │   ├── contact.tsx         # /contact
│   │   ├── auth.login.tsx      # /auth/login
│   │   ├── auth.register.tsx   # /auth/register
│   │   ├── auth.logout.tsx     # /auth/logout
│   │   ├── auth.forgot-password.tsx
│   │   ├── auth.reset-password.tsx
│   │   ├── dashboard.tsx       # /dashboard (layout)
│   │   ├── dashboard._index.tsx
│   │   ├── dashboard.profile.tsx
│   │   ├── dashboard.membership.tsx
│   │   ├── dashboard.usage.tsx
│   │   ├── dashboard.billing.tsx
│   │   ├── features.free.tsx   # /features/free
│   │   ├── features.premium.tsx # /features/premium (protected)
│   │   ├── features.pro.tsx    # /features/pro (protected)
│   │   ├── checkout.tsx        # /checkout
│   │   ├── checkout.success.tsx
│   │   ├── checkout.cancel.tsx
│   │   ├── admin.tsx           # /admin (layout, protected)
│   │   ├── admin._index.tsx
│   │   ├── admin.tiers.tsx
│   │   ├── admin.features.tsx
│   │   └── admin.users.tsx
│   ├── components/
│   │   ├── common/             # LoadingSpinner, ErrorBoundary, Toast
│   │   ├── layout/             # AppBar, Footer, Sidebar
│   │   ├── auth/               # LoginForm, RegisterForm
│   │   ├── profile/            # ProfileForm, AvatarUpload
│   │   ├── membership/         # TierCard, PricingTable, FeatureGate
│   │   ├── billing/            # CheckoutButton, PaymentHistory
│   │   └── admin/              # TierManager, FeatureManager
│   ├── contexts/               # React contexts
│   │   ├── AuthContext.tsx
│   │   └── ThemeContext.tsx
│   ├── lib/                    # Utilities
│   │   ├── supabase.server.ts  # Server-side Supabase client
│   │   ├── supabase.client.ts  # Client-side Supabase client
│   │   ├── api.server.ts       # Server-side API calls
│   │   └── stripe.ts
│   ├── types/                  # TypeScript types
│   │   └── index.ts
│   ├── theme/                  # MUI themes
│   │   ├── light.ts
│   │   └── dark.ts
│   ├── root.tsx                # Root component with providers
│   └── entry.server.tsx        # Server entry point
│   └── entry.client.tsx        # Client entry point
├── public/
├── .env
├── package.json
├── react-router.config.ts      # React Router config
├── tsconfig.json
└── vite.config.ts
```

---

## Phase 1: Project Setup

### 1.1 Initialize Package (React Router v7 Framework)

```bash
cd packages
npx create-react-router@latest frontend
# Select: TypeScript, npm
```

Or manually create with React Router v7 template structure.

### 1.2 Dependencies

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router": "^7.0.0",
    "@react-router/node": "^7.0.0",
    "@react-router/serve": "^7.0.0",
    "@mui/material": "^6.0.0",
    "@mui/icons-material": "^6.0.0",
    "@emotion/react": "^11.0.0",
    "@emotion/styled": "^11.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "@supabase/ssr": "^0.5.0",
    "@stripe/stripe-js": "^4.0.0",
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@react-router/dev": "^7.0.0",
    "typescript": "^5.0.0",
    "vite": "^6.0.0"
  }
}
```

### 1.3 Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BACKEND_URL=http://localhost:3001
VITE_STRIPE_PUBLISHABLE_KEY=
```

### 1.4 Update Root package.json

Add frontend scripts:

```json
"dev:frontend": "npm run dev --workspace=@app/frontend",
"build:frontend": "npm run build --workspace=@app/frontend"
```

---

## Phase 2: Types Setup

### 2.1 Duplicate Types in Frontend

Copy types from `packages/backend/src/types/index.ts` to `packages/frontend/src/types/`
(Manual sync approach - simpler for boilerplate template)

### Key Types to Include

- `MembershipStatus`, `BillingCycle`, `FeatureType`, `PeriodType`, `AdminRole`
- `UserProfile`, `MembershipTier`, `Membership`, `Feature`
- `TrialStatus`, `FeatureUsage`, `UsageSummary`, `UserTierWithFeatures`
- `ApiResponse<T>`, `PaymentHistory`
- Input types: `UpdateProfileInput`, `CreateCheckoutInput`, `ConvertTrialInput`

---

## Phase 3: Core Infrastructure

### 3.1 Supabase Client (`src/lib/supabase.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

### 3.2 API Client (`src/api/client.ts`)

```typescript
export async function apiClient<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // CRITICAL for cookie auth
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  return res.json();
}
```

### 3.3 MUI Theme (`src/theme/`)

- Light theme with primary blue (#2563eb)
- Dark theme with background (#1e293b)
- Shared typography (Inter font)
- Button: no text transform

### 3.4 React Router Context & Loaders

**Root Loader** (`root.tsx`):

- Loads user session from Supabase SSR cookies
- Provides auth state to entire app via `useRouteLoaderData('root')`

**Route Loaders** (SSR data fetching):

- `dashboard.loader` - Fetches user profile, membership, usage
- `membership.loader` - Fetches tiers, current membership, trial status
- `billing.loader` - Fetches payment history
- `admin.loader` - Fetches admin stats (with admin check)

**Context Providers**:

- **AuthContext**: Wraps app, provides user/session from root loader
- **ThemeContext**: Dark/light mode with localStorage persistence

**Actions** (form mutations):

- `profile.action` - Update profile
- `auth.action` - Login/register/logout
- `checkout.action` - Create Stripe session

---

## Phase 4: Layouts

### 4.1 AppBar Component

- Logo on left
- Navigation links: Home, Pricing, Features (dropdown), Contact
- Auth buttons (Login/Register) OR User menu when authenticated
- Dark/Light theme toggle
- Mobile hamburger menu (responsive)

### 4.2 Footer Component

- Basic placeholder with links
- Copyright, social icons placeholders

### 4.3 MainLayout

- AppBar + Footer wrapper
- Outlet for page content

### 4.4 DashboardLayout

- Extends MainLayout
- Left sidebar with: Dashboard, Profile, Membership, Usage, Billing
- User info display

### 4.5 AdminLayout

- Extends DashboardLayout
- Admin-specific sidebar: Tiers, Features, Users
- Admin badge indicator

---

## Phase 5: Authentication

### 5.1 Auth Context/Hook (`useAuth`)

Provides:

- `user`, `session`, `isAuthenticated`, `isAdmin`, `isLoading`
- `signIn(email, password)` - Supabase client direct
- `signUp(email, password, metadata)` - Supabase client direct
- `signOut()` - Supabase client direct
- `resetPassword(email)` - via backend API

### 5.2 Auth Pages

| Page            | Path                    | Description                          |
| --------------- | ----------------------- | ------------------------------------ |
| Login           | `/auth/login`           | Email/password form                  |
| Register        | `/auth/register`        | Email, password, name fields         |
| Logout          | `/auth/logout`          | Sign out and redirect                |
| Forgot Password | `/auth/forgot-password` | Email input, calls backend           |
| Reset Password  | `/auth/reset-password`  | New password form (from email link)  |
| Change Password | `/auth/change-password` | Protected, requires current password |

### 5.3 Route Protection Components

**ProtectedRoute**: Checks authentication, redirects to login if not authenticated

**TierRoute**: Props: `allowedTiers: string[]`

- Checks user's tier against allowed tiers
- Shows upgrade prompt if insufficient

**AdminRoute**: Checks admin role, redirects to dashboard if not admin

---

## Phase 6: Public Pages

### 6.1 Homepage (`/`)

- Hero section with CTA
- Feature highlights (3-5 cards)
- Pricing preview
- Call to action sections

### 6.2 Pricing Page (`/pricing`)

- Pricing table with all tiers
- Monthly/Yearly toggle
- Feature comparison matrix
- "Start Trial" / "Get Started" buttons

### 6.3 Contact Page (`/contact`)

- Contact form (placeholder - no backend)
- Name, email, message fields

### 6.4 Free Feature Page (`/features/free`)

- Accessible to all users
- Demo of free tier features
- Upgrade CTA

---

## Phase 7: Dashboard Pages

### 7.1 Dashboard (`/dashboard`)

- Welcome message
- Current plan card
- Trial banner (if applicable)
- Quick usage stats
- Recent activity placeholder

### 7.2 Profile Page (`/dashboard/profile`)

- Avatar upload
- Profile form: first_name, last_name, phone, company, bio, website
- Email (read-only)
- Delete account button with confirmation

### 7.3 Membership Page (`/dashboard/membership`)

- Current tier details
- Trial status display
- "Start Trial" button (if eligible)
- Tier comparison
- Upgrade/downgrade options

### 7.4 Usage Page (`/dashboard/usage`)

- Feature usage list
- Progress bars for limits
- Period reset dates
- Exceeded warnings

### 7.5 Billing Page (`/dashboard/billing`)

- Current subscription info
- "Manage Subscription" (Stripe Portal)
- Payment history table
- Next billing date

---

## Phase 8: Protected Feature Pages (Functional Demos)

### 8.1 Premium Page (`/features/premium`)

- Protected: requires `premium`, `pro`, or `trial` tier
- **Functional demos that call backend APIs:**
  - Display user's current tier and features
  - Test `check-feature` API for premium features
  - Show usage stats with `GET /api/membership/usage`
  - Increment usage counter demo

### 8.2 Pro Page (`/features/pro`)

- Protected: requires `pro` or `trial` tier
- **Functional demos:**
  - Pro-exclusive feature access tests
  - Advanced usage tracking display
  - Feature limit testing with real API calls

### 8.3 Free Feature Page (`/features/free`)

- Accessible to all (including unauthenticated)
- Demo basic features available to free tier
- Shows upgrade prompts for premium features

### 8.4 FeatureGate Component

```typescript
<FeatureGate allowedTiers={['premium', 'pro']}>
  <PremiumContent />
</FeatureGate>

// Or check specific feature
<FeatureGate featureKey="analytics_dashboard">
  <AnalyticsDashboard />
</FeatureGate>
```

### 8.5 Feature Test Components

Each protected page includes:

- `FeatureAccessTest` - Calls `GET /api/membership/check-feature/:key`
- `UsageTracker` - Displays current usage from `GET /api/membership/usage`
- `IncrementUsageButton` - Tests usage increment (for limit-type features)
- `TierInfoCard` - Shows current tier from `GET /api/membership/features`

---

## Phase 9: Checkout Flow

### 9.1 Checkout Page (`/checkout`)

- Query params: `tier_id`, `billing_cycle`
- Display selected tier details
- Billing cycle toggle
- Price display
- "Proceed to Checkout" button → creates Stripe session

### 9.2 Checkout Success (`/checkout/success`)

- Success message
- New plan details
- "Go to Dashboard" button

### 9.3 Checkout Cancel (`/checkout/cancel`)

- Cancelled message
- "Return to Pricing" button

---

## Phase 10: Admin Dashboard

### 10.1 Admin Dashboard (`/admin`)

- Stats overview cards
- Recent signups list
- Quick action buttons

### 10.2 Tier Management (`/admin/tiers`)

- CRUD for membership tiers
- Feature assignment per tier
- Activate/deactivate tiers

### 10.3 Feature Management (`/admin/features`)

- CRUD for features
- Feature type configuration (boolean/limit/enum)
- Default values

### 10.4 User Management (`/admin/users`)

- User list with search
- View user membership details
- Admin user management (super_admin only)

---

## Phase 11: API Integration

### Backend Endpoints to Integrate

| Module     | Endpoints                                                                                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth       | GET `/api/auth/me`, POST `/api/auth/forgot-password`, POST `/api/auth/reset-password`                                                                                                                |
| Profile    | GET/PUT/DELETE `/api/profile`                                                                                                                                                                        |
| Membership | GET `/api/membership/tiers`, GET `/api/membership`, GET `/api/membership/features`, GET `/api/membership/check-feature/:key`, GET `/api/membership/trial/status`, POST `/api/membership/trial/start` |
| Billing    | POST `/api/billing/create-checkout-session`, POST `/api/billing/create-portal-session`, GET `/api/billing/payment-history`                                                                           |
| Admin      | Full CRUD for tiers, features, users                                                                                                                                                                 |

### Response Format

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
```

---

## Phase 12: Route Configuration (Loaders & Actions)

### Example Route File Structure

```typescript
// app/routes/dashboard.tsx (Layout Route)
import { redirect, type LoaderFunctionArgs } from 'react-router';
import { getSession } from '~/lib/supabase.server';
import { DashboardLayout } from '~/components/layout/DashboardLayout';

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (!session) {
    throw redirect('/auth/login');
  }

  // Fetch dashboard data server-side
  const [profile, membership, usage] = await Promise.all([
    fetchProfile(session.access_token),
    fetchMembership(session.access_token),
    fetchUsage(session.access_token),
  ]);

  return { profile, membership, usage };
}

export default function Dashboard() {
  const { profile, membership, usage } = useLoaderData<typeof loader>();
  return <DashboardLayout profile={profile} membership={membership} />;
}
```

```typescript
// app/routes/dashboard.profile.tsx
import { type ActionFunctionArgs } from 'react-router';
import { updateProfile } from '~/lib/api.server';

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const session = await getSession(request);

  const result = await updateProfile(session.access_token, {
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    // ...
  });

  return { success: true, profile: result };
}

export default function ProfilePage() {
  const { profile } = useRouteLoaderData('routes/dashboard');
  const actionData = useActionData<typeof action>();

  return <ProfileForm profile={profile} />;
}
```

### Route Protection Patterns

```typescript
// Protected route (in loader)
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (!session) throw redirect('/auth/login');
  return { user: session.user };
}

// Tier-protected route
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (!session) throw redirect('/auth/login');

  const membership = await fetchMembership(session.access_token);
  const allowedTiers = ['premium', 'pro', 'trial'];

  if (!allowedTiers.includes(membership.tier_name)) {
    throw redirect('/pricing?upgrade=true');
  }

  return { membership };
}

// Admin-protected route
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await getSession(request);
  if (!session) throw redirect('/auth/login');

  const isAdmin = await checkAdminStatus(session.access_token);
  if (!isAdmin) throw redirect('/dashboard');

  return { isAdmin: true };
}
```

---

## Critical Files to Reference

| File                                                       | Purpose                                    |
| ---------------------------------------------------------- | ------------------------------------------ |
| `packages/backend/src/types/index.ts`                      | Source of truth for all types              |
| `packages/backend/src/config/supabase.ts`                  | Supabase client pattern with @supabase/ssr |
| `packages/backend/src/routes/billing.routes.ts`            | Stripe checkout flow                       |
| `packages/backend/src/middleware/membership.middleware.ts` | Tier/feature access patterns               |

---

## Implementation Order

1. **Setup** - Initialize project, dependencies, folder structure
2. **Types** - Copy types from backend
3. **Theme** - MUI theme configuration
4. **Auth** - Supabase client, auth context, auth pages
5. **Layouts** - AppBar, Footer, MainLayout
6. **Routes** - Router setup, protection components
7. **Public Pages** - Home, Pricing, Contact, Free feature
8. **Dashboard** - Dashboard layout, Profile, Membership pages
9. **API Layer** - All API integration modules
10. **Billing** - Stripe integration, checkout flow
11. **Protected Pages** - Premium, Pro, feature tests
12. **Admin** - Admin dashboard and management pages
13. **Polish** - Error handling, loading states, responsiveness

---

## Key Implementation Notes

1. **Cookie Auth**: All API requests MUST include `credentials: 'include'`
2. **Supabase Direct**: Use Supabase client for signup/signin (not backend API)
3. **Backend for Data**: Use backend API for profile, membership, billing operations
4. **Stripe Redirect**: Checkout creates session on backend, redirects to Stripe
5. **4 Tiers**: Trial (14 days), Free (default), Premium ($29/mo), Pro ($79/mo)
6. **Trial**: One-time use, expires to Free tier automatically
