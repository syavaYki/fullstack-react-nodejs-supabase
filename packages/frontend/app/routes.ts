import { type RouteConfig, index, layout, route, prefix } from '@react-router/dev/routes';

export default [
  // Routes with main layout (Header + Footer)
  layout('routes/_layout.tsx', [
    // Public pages
    index('routes/_index.tsx'),
    route('pricing', 'routes/pricing.tsx'),
    route('contact', 'routes/contact.tsx'),
    // Features page (single unified page with tabs)
    route('features', 'routes/features.tsx'),
    // Auth routes
    ...prefix('auth', [
      route('login', 'routes/auth.login.tsx'),
      route('register', 'routes/auth.register.tsx'),
      route('logout', 'routes/auth.logout.tsx'),
      route('forgot-password', 'routes/auth.forgot-password.tsx'),
      route('reset-password', 'routes/auth.reset-password.tsx'),
      route('change-password', 'routes/auth.change-password.tsx'),
    ]),
    // Checkout routes
    ...prefix('checkout', [
      index('routes/checkout._index.tsx'),
      route('success', 'routes/checkout.success.tsx'),
      route('cancel', 'routes/checkout.cancel.tsx'),
    ]),
  ]),

  // Protected routes (authentication required)
  layout('routes/_protected.tsx', [
    // Dashboard (has its own sidebar layout)
    layout('routes/dashboard.tsx', [
      route('dashboard', 'routes/dashboard._index.tsx'),
      route('dashboard/profile', 'routes/dashboard.profile.tsx'),
      route('dashboard/membership', 'routes/dashboard.membership.tsx'),
      route('dashboard/usage', 'routes/dashboard.usage.tsx'),
      route('dashboard/billing', 'routes/dashboard.billing.tsx'),
    ]),

    // Test routes (for testing tier access)
    layout('routes/test.tsx', [route('test', 'routes/test._index.tsx')]),

    // Admin routes
    layout('routes/admin.tsx', [
      route('admin', 'routes/admin._index.tsx'),
      route('admin/tiers', 'routes/admin.tiers.tsx'),
      route('admin/features', 'routes/admin.features.tsx'),
      route('admin/users', 'routes/admin.users.tsx'),
    ]),
  ]),
] satisfies RouteConfig;
