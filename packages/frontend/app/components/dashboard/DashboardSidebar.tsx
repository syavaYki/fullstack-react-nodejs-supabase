import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { RouterLink } from '~/utils';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import HomeIcon from '@mui/icons-material/Home';
import LogoutIcon from '@mui/icons-material/Logout';
import type { DashboardSidebarProps } from './types';

/**
 * Dashboard sidebar component with navigation menu.
 * Renders as permanent drawer on desktop, temporary on mobile.
 */
export function DashboardSidebar({
  menuItems,
  isActive,
  mobileOpen,
  onMobileClose,
  drawerWidth,
}: DashboardSidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const drawerContent = (
    <Box>
      {/* Logo */}
      <Toolbar>
        <Box
          component={RouterLink}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <RocketLaunchIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
            SaaS
          </Typography>
        </Box>
      </Toolbar>
      <Divider />

      {/* Main Navigation */}
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={isActive(item.path)}
              onClick={() => isMobile && onMobileClose()}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.50',
                  borderRight: 3,
                  borderColor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.100' },
                },
              }}
            >
              <ListItemIcon sx={{ color: isActive(item.path) ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: isActive(item.path) ? 600 : 400,
                  color: isActive(item.path) ? 'primary.main' : 'inherit',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />

      {/* Secondary Navigation */}
      <List>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/">
            <ListItemIcon>
              <HomeIcon />
            </ListItemIcon>
            <ListItemText primary="Back to Home" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/auth/logout">
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: drawerWidth },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { width: drawerWidth },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}
