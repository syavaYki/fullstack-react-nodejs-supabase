import { Link } from 'react-router';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Divider,
  Button,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import type { MobileDrawerProps } from './types';

/**
 * Mobile navigation drawer component.
 * Slides in from the right on mobile devices.
 */
export function MobileDrawer({
  open,
  onClose,
  navItems,
  isActive,
  isAuthenticated,
}: MobileDrawerProps) {
  const drawerContent = (
    <Box onClick={onClose} sx={{ textAlign: 'center' }}>
      {/* Logo */}
      <Box
        sx={{
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
        }}
      >
        <RocketLaunchIcon color="primary" />
        <Typography variant="h6" color="primary">
          SaaS
        </Typography>
      </Box>

      {/* Navigation Items */}
      <List>
        {navItems.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              sx={{
                textAlign: 'center',
                bgcolor: isActive(item.path) ? 'primary.50' : 'transparent',
              }}
            >
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  color: isActive(item.path) ? 'primary.main' : 'text.primary',
                  fontWeight: isActive(item.path) ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}

        <Divider sx={{ my: 1 }} />

        {/* Auth-specific items */}
        {isAuthenticated ? (
          <>
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/dashboard" sx={{ textAlign: 'center' }}>
                <ListItemText primary="Dashboard" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/auth/logout" sx={{ textAlign: 'center' }}>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </>
        ) : (
          <>
            <ListItem disablePadding>
              <ListItemButton component={Link} to="/auth/login" sx={{ textAlign: 'center' }}>
                <ListItemText primary="Login" />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding sx={{ px: 2, pt: 1 }}>
              <Button component={Link} to="/auth/register" variant="contained" fullWidth>
                Get Started
              </Button>
            </ListItem>
          </>
        )}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant="temporary"
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': {
          boxSizing: 'border-box',
          width: 280,
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
