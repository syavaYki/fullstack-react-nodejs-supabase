/**
 * Contact API
 * Contact form submission endpoint
 */

import { apiClient } from './client';
import type { ContactSubmissionInput } from '../types';

/**
 * Submit contact form
 */
export async function submitContactForm(data: ContactSubmissionInput) {
  return apiClient.post<{ message: string }>('/api/contact', data);
}
