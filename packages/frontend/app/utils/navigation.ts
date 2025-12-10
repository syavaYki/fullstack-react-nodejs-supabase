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
