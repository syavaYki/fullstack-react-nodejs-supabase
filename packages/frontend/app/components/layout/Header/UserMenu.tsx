import { Link } from 'react-router';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemIcon,
  Typography,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import type { UserMenuProps } from './types';

/**
 * User menu component for authenticated users.
 * Shows avatar button that opens dropdown with navigation options.
 */
export function UserMenu({
  user,
  isAdmin,
  anchorEl,
  onOpen,
  onClose,
  userInitials,
}: UserMenuProps) {
  const isMenuOpen = Boolean(anchorEl);

  return (
    <>
      <IconButton onClick={onOpen} size="small" sx={{ ml: 1 }}>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'primary.main',
          }}
        >
          {userInitials}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={onClose}
        onClick={onClose}
        transformOrigin={{
          horizontal: 'right',
          vertical: 'top',
        }}
        anchorOrigin={{
          horizontal: 'right',
          vertical: 'bottom',
        }}
      >
        <MenuItem disabled>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem component={Link} to="/dashboard">
          <ListItemIcon>
            <DashboardIcon fontSize="small" />
          </ListItemIcon>
          Dashboard
        </MenuItem>
        <MenuItem component={Link} to="/dashboard/profile">
          <ListItemIcon>
            <AccountCircleIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem component={Link} to="/dashboard/membership">
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Membership
        </MenuItem>
        {isAdmin && (
          <MenuItem component={Link} to="/admin">
            <ListItemIcon>
              <AdminPanelSettingsIcon fontSize="small" />
            </ListItemIcon>
            Admin
          </MenuItem>
        )}
        <Divider />
        <MenuItem component={Link} to="/auth/logout">
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </>
  );
}

/**
 * Auth buttons component for non-authenticated users.
 * Shows Login and Get Started buttons.
 */
export function AuthButtons() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Button component={Link} to="/auth/login" color="inherit">
        Login
      </Button>
      <Button component={Link} to="/auth/register" variant="contained">
        Get Started
      </Button>
    </Box>
  );
}
