export interface BugReportInput {
  name?: string;
  email?: string;
  description: string;
  page_url?: string;
}

export interface BugReportResponse {
  id: string;
  images_uploaded: number;
}

const BACKEND_URL =
  typeof window !== 'undefined' ? import.meta.env.VITE_BACKEND_URL : process.env.VITE_BACKEND_URL;

/**
 * Submits a bug report with optional image attachments.
 * Uses multipart/form-data to support file uploads.
 */
export async function submitBugReport(
  input: BugReportInput,
  images: File[]
): Promise<
  { success: true; data: BugReportResponse; message: string } | { success: false; error: string }
> {
  try {
    const form = new FormData();

    if (input.name) form.append('name', input.name);
    if (input.email) form.append('email', input.email);
    form.append('description', input.description);
    if (input.page_url) form.append('page_url', input.page_url);
    images.forEach((img) => form.append('images', img));

    const response = await fetch(`${BACKEND_URL}/api/bug-reports`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      // No Content-Type header — browser sets it with boundary for multipart
    });

    return await response.json();
  } catch {
    return { success: false, error: 'Network error. Please try again.' };
  }
}
