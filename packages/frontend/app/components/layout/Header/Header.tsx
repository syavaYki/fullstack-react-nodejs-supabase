import { useState, useMemo } from 'react';
import { useLocation } from 'react-router';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Container,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useAuth } from '~/contexts';
import { isActivePath, RouterLink } from '~/utils';
import { NavItems } from './NavItems';
import { UserMenu, AuthButtons } from './UserMenu';
import { MobileDrawer } from './MobileDrawer';
import type { NavItem } from './types';

/**
 * Default navigation items for the header
 */
const defaultNavItems: NavItem[] = [
  { label: 'Home', path: '/' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Features', path: '/features' },
  { label: 'Contact', path: '/contact' },
];

/**
 * Main header component with responsive navigation.
 * Includes desktop navigation, user menu, and mobile drawer.
 */
export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated, isAdmin } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const isActive = (path: string) => isActivePath(location.pathname, path);

  // Memoize user initials to avoid recalculating on every render
  const userInitials = useMemo(
    () => user?.email?.substring(0, 2).toUpperCase() || 'U',
    [user?.email]
  );

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            {/* Logo */}
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
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 700,
                  color: 'primary.main',
                }}
              >
                SaaS
              </Typography>
            </Box>

            {/* Desktop Navigation */}
            {!isMobile && <NavItems items={defaultNavItems} isActive={isActive} />}

            {/* Auth Buttons / User Menu */}
            {!isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isAuthenticated ? (
                  <UserMenu
                    user={user}
                    isAdmin={isAdmin}
                    anchorEl={anchorEl}
                    onOpen={handleMenuOpen}
                    onClose={handleMenuClose}
                    userInitials={userInitials}
                  />
                ) : (
                  <AuthButtons />
                )}
              </Box>
            )}

            {/* Mobile Menu Button */}
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="end"
                onClick={handleDrawerToggle}
              >
                <MenuIcon />
              </IconButton>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={handleDrawerToggle}
        navItems={defaultNavItems}
        isActive={isActive}
        isAuthenticated={isAuthenticated}
      />
    </>
  );
}
