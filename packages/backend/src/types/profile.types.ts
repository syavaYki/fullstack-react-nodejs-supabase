export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  company: string | null;
  bio: string | null;
  website: string | null;
  stripe_customer_id: string | null;
  profile_completeness: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  avatar_url?: string | null;
  phone?: string | null;
  company?: string | null;
  bio?: string | null;
  website?: string;
}
