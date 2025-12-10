import { Outlet, Link } from 'react-router';
import { Box, Container, AppBar, Toolbar, Typography, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ScienceIcon from '@mui/icons-material/Science';
import { ProtectedRoute } from '~/components/auth';

function TestLayoutContent() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <ScienceIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Tier Access Test
          </Typography>
          <Button component={Link} to="/dashboard" startIcon={<ArrowBackIcon />} color="inherit">
            Back to Dashboard
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

export default function TestLayout() {
  return (
    <ProtectedRoute>
      <TestLayoutContent />
    </ProtectedRoute>
  );
}
