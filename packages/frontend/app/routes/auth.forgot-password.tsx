import type { Route } from './+types/auth.forgot-password';
import { useState, type FormEvent } from 'react';
import {
  Box,
  Container,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Link as MuiLink,
  Alert,
  CircularProgress,
} from '@mui/material';
import { RouterLink } from '~/utils';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { resetPassword } from '~/lib/supabase.client';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Forgot Password - SaaS Boilerplate' },
    { name: 'description', content: 'Reset your password' },
  ];
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await resetPassword(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
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
          <Card>
            <CardContent sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom color="success.main">
                Check your email
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We've sent a password reset link to <strong>{email}</strong>
              </Typography>
              <Button component={RouterLink} to="/auth/login" variant="contained">
                Back to Login
              </Button>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

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
            Forgot your password?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your email and we'll send you a reset link
          </Typography>
        </Box>

        <Card>
          <CardContent sx={{ p: 4 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={3}>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </Stack>
            </Box>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <MuiLink
                component={RouterLink}
                to="/auth/login"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  textDecoration: 'none',
                }}
              >
                <ArrowBackIcon fontSize="small" />
                Back to login
              </MuiLink>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
