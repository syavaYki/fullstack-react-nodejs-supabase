import { Outlet } from 'react-router';
import { ProtectedRoute } from '~/components/auth/ProtectedRoute';

/**
 * Protected layout wrapper.
 * All routes nested under this layout require authentication.
 */
export default function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <Outlet />
    </ProtectedRoute>
  );
}
