/**
 * Convert cents to formatted currency string
 * @param amount Amount in cents
 * @param currency Currency code (default: 'usd')
 * @returns Formatted currency string (e.g., "$9.99")
 */
export function formatPrice(amount: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

/**
 * Format date string to localized short format
 * @param dateString ISO date string or null
 * @returns Formatted date (e.g., "Jan 15, 2024") or "N/A" if null
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Capitalize first letter of a string
 * @param str String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
