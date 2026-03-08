import { useState, useMemo, useEffect } from 'react';
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
import { branding } from '@config/branding';
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
 * Scroll-aware: transparent at top, frosted-glass on scroll.
 */
export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          boxShadow: scrolled ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          color: scrolled ? 'text.primary' : '#0f172a',
          transition: 'all 0.3s ease',
        }}
      >
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
                {branding.logoText}
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
