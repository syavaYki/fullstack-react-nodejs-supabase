import type { Route } from './+types/checkout.cancel';
import { Box, Container, Typography, Card, CardContent, Button, Stack } from '@mui/material';
import { Link } from 'react-router';
import CancelIcon from '@mui/icons-material/Cancel';

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Payment Cancelled - SaaS Boilerplate' }];
}

export default function CheckoutCancelPage() {
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
            <CancelIcon color="error" sx={{ fontSize: 80, mb: 3 }} />
            <Typography variant="h4" gutterBottom>
              Payment Cancelled
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Your payment was cancelled. No charges were made to your account. You can try again or
              explore our free tier.
            </Typography>
            <Stack spacing={2}>
              <Button component={Link} to="/pricing" variant="contained" size="large">
                Return to Pricing
              </Button>
              <Button component={Link} to="/dashboard" variant="outlined">
                Go to Dashboard
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
