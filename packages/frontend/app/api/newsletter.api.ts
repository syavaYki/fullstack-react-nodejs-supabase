/**
 * @file newsletter.api.ts
 * @description Newsletter subscription API calls.
 */

import { apiClient } from './client';

/** Subscribe an email to the newsletter (public) */
export async function subscribeToNewsletter(email: string) {
  return apiClient.post('/api/newsletter/subscribe', { email });
}
