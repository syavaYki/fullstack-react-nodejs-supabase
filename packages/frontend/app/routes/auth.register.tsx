import type { Route } from './+types/auth.register';
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
  Divider,
  Link as MuiLink,
  Grid2 as Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Link, useNavigate } from 'react-router';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useAuth } from '~/contexts';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Sign Up - SaaS Boilerplate' },
    { name: 'description', content: 'Create your account' },
  ];
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp, isLoading: authLoading } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await signUp(email, password, {
        first_name: firstName || undefined,
        last_name: lastName || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const loading = isLoading || authLoading;

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
                Account Created!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Please check your email to verify your account.
              </Typography>
              <Button component={Link} to="/auth/login" variant="contained">
                Go to Login
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
            component={Link}
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
            Create your account
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Start your free trial today
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
                <Grid container spacing={2}>
                  <Grid size={6}>
                    <TextField
                      label="First Name"
                      fullWidth
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={loading}
                    />
                  </Grid>
                  <Grid size={6}>
                    <TextField
                      label="Last Name"
                      fullWidth
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={loading}
                    />
                  </Grid>
                </Grid>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
                <TextField
                  label="Password"
                  type="password"
                  fullWidth
                  required
                  autoComplete="new-password"
                  helperText="Must be at least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <TextField
                  label="Confirm Password"
                  type="password"
                  fullWidth
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  error={confirmPassword !== '' && password !== confirmPassword}
                  helperText={
                    confirmPassword !== '' && password !== confirmPassword
                      ? 'Passwords do not match'
                      : undefined
                  }
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
                <Typography variant="caption" color="text.secondary" textAlign="center">
                  By signing up, you agree to our{' '}
                  <MuiLink href="#" sx={{ textDecoration: 'none' }}>
                    Terms of Service
                  </MuiLink>{' '}
                  and{' '}
                  <MuiLink href="#" sx={{ textDecoration: 'none' }}>
                    Privacy Policy
                  </MuiLink>
                </Typography>
              </Stack>
            </Box>

            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                or
              </Typography>
            </Divider>

            <Typography variant="body2" textAlign="center">
              Already have an account?{' '}
              <MuiLink
                component={Link}
                to="/auth/login"
                sx={{ textDecoration: 'none', fontWeight: 500 }}
              >
                Sign in
              </MuiLink>
            </Typography>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
