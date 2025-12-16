import type { Route } from './+types/auth.reset-password';
import { useState, useEffect, type FormEvent } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useSearchParams, useNavigate } from 'react-router';
import { RouterLink } from '~/utils';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { updatePassword } from '~/lib/supabase.client';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Reset Password - SaaS Boilerplate' },
    { name: 'description', content: 'Set your new password' },
  ];
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null); // Invalid/expired token error
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check for error params from Supabase (invalid/expired token)
  useEffect(() => {
    const errorDesc = searchParams.get('error_description');
    if (errorDesc) {
      setLinkError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate minimum length
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => navigate('/auth/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'grey.50',
        py: 8,
      }}
    >
      <Container maxWidth="sm">
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            component={RouterLink}
            to="/"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              textDecoration: 'none',
              color: 'inherit',
              mb: 2,
            }}
          >
            <RocketLaunchIcon color="primary" sx={{ fontSize: 40 }} />
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.main' }}>
              SaaS
            </Typography>
          </Box>
          <Typography variant="h5" gutterBottom>
            Set new password
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your new password below
          </Typography>
        </Box>

        <Card>
          <CardContent sx={{ p: 4 }}>
            {/* Link error - invalid/expired token */}
            {linkError ? (
              <Stack spacing={3}>
                <Alert severity="error">{linkError}</Alert>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Please request a new password reset link.
                </Typography>
                <Button
                  component={RouterLink}
                  to="/auth/forgot-password"
                  variant="contained"
                  size="large"
                  fullWidth
                >
                  Request New Link
                </Button>
              </Stack>
            ) : success ? (
              <Alert severity="success">Password reset successful! Redirecting to login...</Alert>
            ) : (
              <>
                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}
                <Box component="form" onSubmit={handleSubmit}>
                  <Stack spacing={3}>
                    <TextField
                      label="New Password"
                      type="password"
                      fullWidth
                      required
                      autoComplete="new-password"
                      helperText="Must be at least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <TextField
                      label="Confirm New Password"
                      type="password"
                      fullWidth
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={isLoading}
                      startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                      {isLoading ? 'Resetting...' : 'Reset Password'}
                    </Button>
                  </Stack>
                </Box>
              </>
            )}
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
