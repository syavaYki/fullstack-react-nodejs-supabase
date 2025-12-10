import type { Route } from './+types/admin';
import { Outlet, Link, useLocation, redirect } from 'react-router';
import {
  Box,
  Container,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import LayersIcon from '@mui/icons-material/Layers';
import ExtensionIcon from '@mui/icons-material/Extension';
import PeopleIcon from '@mui/icons-material/People';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Admin Dashboard - SaaS Boilerplate' },
    { name: 'description', content: 'Admin dashboard for managing the application' },
  ];
}

export async function loader({ request: _request }: Route.LoaderArgs) {
  // Admin functionality is disabled - redirect all users to dashboard
  // To enable admin access, implement proper role checking:
  // 1. Get session from Supabase
  // 2. Check if user has admin role in database
  // 3. Only allow access if user is verified admin
  throw redirect('/dashboard');
}

const drawerWidth = 260;

const adminNavItems = [
  { label: 'Dashboard', path: '/admin', icon: <DashboardIcon /> },
  { label: 'Tiers', path: '/admin/tiers', icon: <LayersIcon /> },
  { label: 'Features', path: '/admin/features', icon: <ExtensionIcon /> },
  { label: 'Users', path: '/admin/users', icon: <PeopleIcon /> },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <Box sx={{ display: 'flex', flex: 1 }}>
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              position: 'relative',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <Box sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AdminPanelSettingsIcon color="primary" />
              <Typography variant="h6">Admin Panel</Typography>
            </Box>
            <Chip label="Super Admin" size="small" color="error" />
          </Box>
          <Divider />
          <List>
            {adminNavItems.map((item) => (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  selected={location.pathname === item.path}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: 'grey.50',
            minHeight: '100%',
          }}
        >
          <Container maxWidth="xl" sx={{ py: 4 }}>
            <Outlet />
          </Container>
        </Box>
      </Box>
      <Footer />
    </Box>
  );
}
