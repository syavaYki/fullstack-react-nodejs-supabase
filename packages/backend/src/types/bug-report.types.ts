export type BugReportStatus = 'new' | 'in_progress' | 'resolved' | 'closed' | 'duplicate';

export interface BugReportImageMetadata {
  name: string;
  url: string;
  size: number;
  uploaded_at: string;
}

export interface BugReport {
  id: string;
  name: string | null;
  email: string | null;
  description: string;
  images: BugReportImageMetadata[];
  page_url: string | null;
  user_agent: string | null;
  ip_address: string | null;
  status: BugReportStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateBugReportInput {
  name?: string;
  email?: string;
  description: string;
  page_url?: string;
}
