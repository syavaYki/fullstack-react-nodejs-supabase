/**
 * Navigation item configuration for header navigation
 */
export interface NavItem {
  label: string;
  path: string;
}

/**
 * User menu item configuration
 */
export interface UserMenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

/**
 * Props for NavItems component
 */
export interface NavItemsProps {
  items: NavItem[];
  isActive: (path: string) => boolean;
}

/**
 * Props for UserMenu component
 */
export interface UserMenuProps {
  user: { email?: string } | null;
  isAdmin: boolean;
  anchorEl: HTMLElement | null;
  onOpen: (event: React.MouseEvent<HTMLElement>) => void;
  onClose: () => void;
  userInitials: string;
}

/**
 * Props for MobileDrawer component
 */
export interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  navItems: NavItem[];
  isActive: (path: string) => boolean;
  isAuthenticated: boolean;
}
