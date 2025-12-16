import { forwardRef } from 'react';
import { Link as RRLink, type LinkProps as RRLinkProps } from 'react-router';

/**
 * Check if a route path is currently active
 * @param currentPath Current location pathname
 * @param targetPath Target path to check
 * @returns True if route is active
 */
export function isActivePath(currentPath: string, targetPath: string): boolean {
  if (targetPath === '/') return currentPath === '/';
  return currentPath.startsWith(targetPath);
}

/**
 * MUI-compatible Link adapter for React Router v7
 * This component properly forwards refs and handles the polymorphic component pattern
 * used by MUI components like Button, MenuItem, ListItemButton, etc.
 *
 * Usage: <Button component={RouterLink} to="/path">Click me</Button>
 */
export const RouterLink = forwardRef<HTMLAnchorElement, RRLinkProps>(
  function RouterLink(props, ref) {
    return <RRLink ref={ref} {...props} />;
  }
);

// Alias for backwards compatibility
export const MuiLink = RouterLink;
