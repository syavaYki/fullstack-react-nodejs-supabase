/**
 * AdminRoute Component
 * Wraps routes that require admin access
 * Redirects to dashboard if not an admin
 */

import { Navigate } from 'react-router';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import type { ReactNode } from 'react';

interface AdminRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'super_admin';
}

export function AdminRoute({ children, requiredRole }: AdminRouteProps) {
  const { isAdmin, adminRole, isLoading } = useAuth();

  // Wrap in ProtectedRoute to handle authentication first
  return (
    <ProtectedRoute>
      {isLoading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
          }}
        >
          <CircularProgress />
        </Box>
      ) : !isAdmin ? (
        <Navigate to="/dashboard" replace />
      ) : requiredRole && adminRole !== requiredRole && adminRole !== 'super_admin' ? (
        <Navigate to="/admin" replace />
      ) : (
        <>{children}</>
      )}
    </ProtectedRoute>
  );
}

export default AdminRoute;
