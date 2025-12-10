/**
 * Dashboard menu item configuration
 */
export interface DashboardMenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

/**
 * Props for DashboardSidebar component
 */
export interface DashboardSidebarProps {
  menuItems: DashboardMenuItem[];
  isActive: (path: string) => boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  drawerWidth: number;
}

/**
 * Props for DashboardAppBar component
 */
export interface DashboardAppBarProps {
  onMenuClick: () => void;
  user: { email?: string } | null;
  drawerWidth: number;
}
