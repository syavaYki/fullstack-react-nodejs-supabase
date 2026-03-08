export interface ContactSubmission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'closed';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

/** Input for creating a contact form submission */
export interface CreateContactSubmissionInput {
  first_name: string;
  last_name: string;
  email: string;
  subject: string;
  message: string;
}
