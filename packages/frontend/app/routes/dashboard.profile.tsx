import type { Route } from './+types/dashboard.profile';
import { useState, useEffect, type FormEvent } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid2 as Grid,
  Avatar,
  Stack,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,
} from '@mui/material';
import { useNavigate, useLoaderData, useFetcher, Link } from 'react-router';
import { useAuth } from '~/contexts';
import * as profileApi from '~/api/profile.api';
import type { UserProfile, UpdateProfileInput } from '~/types';
import { getInitials, getDisplayName, formatDate } from '~/utils';
import { fetchWithCookies, serverFetch } from '~/lib/fetch.server';

export async function loader({ request }: Route.LoaderArgs) {
  const profile = await fetchWithCookies<UserProfile>('/api/profile', request);
  return { profile };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'delete') {
    const result = await serverFetch<{ message: string }>('/api/profile', request, {
      method: 'DELETE',
    });

    if (result.success) {
      // Redirect to home after successful deletion
      // The client will handle signing out
      return { success: true, deleted: true };
    }

    return { success: false, error: result.error || 'Failed to delete account' };
  }

  return { success: false, error: 'Invalid action' };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Profile - SaaS Boilerplate' }];
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const loaderData = useLoaderData<typeof loader>();
  const deleteFetcher = useFetcher<typeof action>();

  const [profile, setProfile] = useState<UserProfile | null>(loaderData.profile);
  const [isLoading, setIsLoading] = useState(!loaderData.profile);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const isDeleting = deleteFetcher.state !== 'idle';

  // Handle delete action result
  useEffect(() => {
    if (deleteFetcher.data?.deleted) {
      signOut();
      navigate('/');
    } else if (deleteFetcher.data?.error) {
      setError(deleteFetcher.data.error);
      setDeleteDialogOpen(false);
    }
  }, [deleteFetcher.data, signOut, navigate]);

  // Form state - initialize from loader data
  const [firstName, setFirstName] = useState(loaderData.profile?.first_name || '');
  const [lastName, setLastName] = useState(loaderData.profile?.last_name || '');
  const [phone, setPhone] = useState(loaderData.profile?.phone || '');
  const [company, setCompany] = useState(loaderData.profile?.company || '');
  const [website, setWebsite] = useState(loaderData.profile?.website || '');
  const [bio, setBio] = useState(loaderData.profile?.bio || '');

  // Sync state when loader data changes (handles hydration)
  useEffect(() => {
    if (loaderData.profile) {
      setProfile(loaderData.profile);
      setFirstName(loaderData.profile.first_name || '');
      setLastName(loaderData.profile.last_name || '');
      setPhone(loaderData.profile.phone || '');
      setCompany(loaderData.profile.company || '');
      setWebsite(loaderData.profile.website || '');
      setBio(loaderData.profile.bio || '');
      setIsLoading(false);
    }
  }, [loaderData.profile]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const updateData: UpdateProfileInput = {
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        company: company || null,
        website: website || null,
        bio: bio || null,
      };

      const res = await profileApi.updateProfile(updateData);
      if (res.success && res.data) {
        setProfile(res.data);
        setSuccess('Profile updated successfully');
      } else {
        setError(res.error || 'Failed to update profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    setError(null);
    deleteFetcher.submit({ intent: 'delete' }, { method: 'POST' });
  };

  if (isLoading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" width={300} height={24} sx={{ mb: 4 }} />
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 1 }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 1, mb: 3 }} />
            <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 1 }} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile Settings
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage your account information
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" gutterBottom>
                Personal Information
              </Typography>
              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      fullWidth
                      disabled={isSaving}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      fullWidth
                      disabled={isSaving}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      label="Email"
                      type="email"
                      value={profile?.email || user?.email || ''}
                      fullWidth
                      disabled
                      helperText="Email cannot be changed"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      fullWidth
                      disabled={isSaving}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Company"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      fullWidth
                      disabled={isSaving}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      label="Website"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      fullWidth
                      disabled={isSaving}
                      placeholder="https://example.com"
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      label="Bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      multiline
                      rows={3}
                      placeholder="Tell us about yourself..."
                      fullWidth
                      disabled={isSaving}
                    />
                  </Grid>
                  <Grid size={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={isSaving}
                      startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={3}>
            <Card>
              <CardContent sx={{ p: 4, textAlign: 'center' }}>
                <Avatar
                  src={profile?.avatar_url || undefined}
                  sx={{
                    width: 100,
                    height: 100,
                    mx: 'auto',
                    mb: 2,
                    bgcolor: 'primary.main',
                  }}
                >
                  {getInitials(
                    firstName || profile?.first_name,
                    lastName || profile?.last_name,
                    user?.email
                  )}
                </Avatar>
                <Typography variant="h6">
                  {getDisplayName(profile?.first_name, profile?.last_name, user?.email)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {profile?.email || user?.email}
                </Typography>
                {profile?.created_at && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    Member since {formatDate(profile.created_at)}
                  </Typography>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Security
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Manage your account security settings
                </Typography>
                <Button component={Link} to="/auth/change-password" variant="outlined" fullWidth>
                  Change Password
                </Button>
              </CardContent>
            </Card>

            <Card
              sx={{
                border: 1,
                borderColor: 'error.light',
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" color="error" gutterBottom>
                  Danger Zone
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Once you delete your account, there is no going back.
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete your account? This action cannot be undone. All your
            data, including your profile, membership, and usage history will be permanently deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAccount}
            color="error"
            variant="contained"
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
