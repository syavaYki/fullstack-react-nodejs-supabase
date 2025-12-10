import { Outlet } from 'react-router';
import { Box } from '@mui/material';
import { Header } from '~/components/layout/Header';
import { Footer } from '~/components/layout/Footer';

export default function MainLayout() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <Header />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>
      <Footer />
    </Box>
  );
}
