/**
 * Get user initials from name or email
 * @param firstName User's first name
 * @param lastName User's last name
 * @param email User's email (fallback)
 * @returns Uppercase initials (e.g., "JD" or "U")
 */
export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const first = firstName || '';
  const last = lastName || '';

  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }

  return email?.charAt(0).toUpperCase() || '?';
}

/**
 * Get display name from profile or email
 * @param firstName User's first name
 * @param lastName User's last name
 * @param email User's email (fallback)
 * @returns Display name or email username
 */
export function getDisplayName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null
): string {
  const first = firstName || '';
  const last = lastName || '';

  if (first || last) {
    return `${first} ${last}`.trim();
  }

  return email?.split('@')[0] || 'User';
}
