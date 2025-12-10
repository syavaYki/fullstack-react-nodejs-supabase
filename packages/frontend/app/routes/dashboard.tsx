import { useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import type { Route } from './+types/dashboard';
import { Box, Toolbar, Container } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import BarChartIcon from '@mui/icons-material/BarChart';
import PaymentIcon from '@mui/icons-material/Payment';
import ScienceIcon from '@mui/icons-material/Science';
import { useAuth } from '~/contexts';
import { ProtectedRoute } from '~/components/auth';
import { DashboardSidebar, DashboardAppBar } from '~/components/dashboard';
import type { DashboardMenuItem } from '~/components/dashboard';

/** Drawer width constant */
const DRAWER_WIDTH = 240;

/** Dashboard navigation menu items */
const menuItems: DashboardMenuItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Profile', path: '/dashboard/profile', icon: <PersonIcon /> },
  { label: 'Membership', path: '/dashboard/membership', icon: <CardMembershipIcon /> },
  { label: 'Usage', path: '/dashboard/usage', icon: <BarChartIcon /> },
  { label: 'Billing', path: '/dashboard/billing', icon: <PaymentIcon /> },
  { label: 'Tier Test', path: '/test', icon: <ScienceIcon /> },
];

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Dashboard - SaaS Boilerplate' }];
}

/**
 * Dashboard content component.
 * Contains the main dashboard layout with sidebar and app bar.
 */
function DashboardContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <DashboardAppBar onMenuClick={handleDrawerToggle} user={user} drawerWidth={DRAWER_WIDTH} />

      {/* Sidebar */}
      <DashboardSidebar
        menuItems={menuItems}
        isActive={isActive}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        drawerWidth={DRAWER_WIDTH}
      />

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: 'grey.50',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Container maxWidth="lg">
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}

/**
 * Dashboard layout route component.
 * Wraps content in ProtectedRoute for authentication.
 */
export default function DashboardLayout() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
