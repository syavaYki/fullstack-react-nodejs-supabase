import { useState, useMemo } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
} from '@mui/material';
import { RouterLink } from '~/utils';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import type { DashboardAppBarProps } from './types';

/**
 * Dashboard app bar component with user menu.
 * Positioned at top of dashboard, offset for sidebar on desktop.
 */
export function DashboardAppBar({ onMenuClick, user, drawerWidth }: DashboardAppBarProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Memoize user initials
  const userInitials = useMemo(
    () => user?.email?.substring(0, 2).toUpperCase() || 'U',
    [user?.email]
  );

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${drawerWidth}px)` },
        ml: { md: `${drawerWidth}px` },
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar>
        {/* Mobile Menu Button */}
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: 'none' } }}
          aria-label="open sidebar"
        >
          <MenuIcon />
        </IconButton>

        {/* Title */}
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          Dashboard
        </Typography>

        {/* User Avatar */}
        <IconButton onClick={handleMenuOpen} aria-label="user menu">
          <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>{userInitials}</Avatar>
        </IconButton>

        {/* User Menu Dropdown */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          onClick={handleMenuClose}
        >
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {user?.email}
            </Typography>
          </MenuItem>
          <Divider />
          <MenuItem component={RouterLink} to="/dashboard/profile">
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            Profile
          </MenuItem>
          <MenuItem component={RouterLink} to="/auth/logout">
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
