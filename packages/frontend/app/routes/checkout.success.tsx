import type { Route } from './+types/checkout.success';
import { Box, Container, Typography, Card, CardContent, Button, Stack } from '@mui/material';
import { RouterLink } from '~/utils';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Payment Successful - SaaS Boilerplate' }];
}

export default function CheckoutSuccessPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        bgcolor: 'grey.50',
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent sx={{ p: 6, textAlign: 'center' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 3 }} />
            <Typography variant="h4" gutterBottom>
              Payment Successful!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Thank you for your purchase. Your subscription is now active and you have full access
              to all features.
            </Typography>
            <Stack spacing={2}>
              <Button component={RouterLink} to="/dashboard" variant="contained" size="large">
                Go to Dashboard
              </Button>
              <Button component={RouterLink} to="/dashboard/membership" variant="outlined">
                View Membership
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
