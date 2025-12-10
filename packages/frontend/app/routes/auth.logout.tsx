import type { Route } from './+types/auth.logout';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '~/contexts';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Logout - SaaS Boilerplate' }];
}

export default function LogoutPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        await signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      } finally {
        navigate('/');
      }
    };

    handleLogout();
  }, [signOut, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body1" color="text.secondary">
        Signing out...
      </Typography>
    </Box>
  );
}
