import { Box, Button } from '@mui/material';
import { RouterLink } from '~/utils';
import type { NavItemsProps } from './types';

/**
 * Desktop navigation items component.
 * Renders horizontal navigation buttons for the header.
 */
export function NavItems({ items, isActive }: NavItemsProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {items.map((item) => (
        <Button
          key={item.label}
          component={RouterLink}
          to={item.path}
          sx={{
            color: isActive(item.path) ? 'primary.main' : 'text.secondary',
            fontWeight: isActive(item.path) ? 600 : 400,
            '&:hover': {
              color: 'primary.main',
              bgcolor: 'primary.50',
            },
          }}
        >
          {item.label}
        </Button>
      ))}
    </Box>
  );
}
