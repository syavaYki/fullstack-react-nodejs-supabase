import { branding } from '@config/branding';

/** Returns a formatted page title: "Page - {metaTitleSuffix}" */
export function pageTitle(page: string): string {
  return `${page} - ${branding.metaTitleSuffix}`;
}
