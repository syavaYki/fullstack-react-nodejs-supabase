/**
 * @file sitemap.ts
 * @description Centralized route path constants.
 */

export const SITE_MAP = {
  home: '/',
  login: '/auth/login',
  register: '/auth/register',
  logout: '/auth/logout',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  dashboard: '/dashboard',
  profile: '/dashboard/profile',
  membership: '/dashboard/membership',
  billing: '/dashboard/billing',
  contact: '/contact',
  pricing: '/pricing',
} as const;
