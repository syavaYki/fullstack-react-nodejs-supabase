import type { Route } from './+types/checkout._index';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid2 as Grid,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Skeleton,
} from '@mui/material';
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import CheckIcon from '@mui/icons-material/Check';
import LockIcon from '@mui/icons-material/Lock';
import { useAuth } from '~/contexts';
import {
  getPublicTiersWithFeatures,
  changeTier,
  type TierWithFeatures,
} from '~/api/membership.api';
import { formatFeatureDisplay } from '~/utils';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Checkout - SaaS Boilerplate' },
    { name: 'description', content: 'Complete your purchase' },
  ];
}

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const tierIdParam = searchParams.get('tier');
  const cycleParam = searchParams.get('cycle') as 'monthly' | 'yearly' | null;

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(cycleParam || 'monthly');
  const [selectedTier, setSelectedTier] = useState<TierWithFeatures | null>(null);
  const [isLoadingTier, setIsLoadingTier] = useState(true);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tier details
  useEffect(() => {
    async function fetchTier() {
      if (!tierIdParam) {
        setError('No tier selected. Please go back to pricing.');
        setIsLoadingTier(false);
        return;
      }

      try {
        const response = await getPublicTiersWithFeatures();
        if (response.success && response.data) {
          const tier = response.data.find((t) => t.id === tierIdParam);
          if (tier) {
            setSelectedTier(tier);
          } else {
            setError('Tier not found. Please go back to pricing.');
          }
        } else {
          setError('Failed to load tier details.');
        }
      } catch (err) {
        setError('Failed to load tier details.');
      } finally {
        setIsLoadingTier(false);
      }
    }

    fetchTier();
  }, [tierIdParam]);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      navigate('/auth/login?redirect=/checkout?' + searchParams.toString());
      return;
    }

    if (!tierIdParam) {
      setError('No tier selected. Please go back to pricing.');
      return;
    }

    setIsCheckingOut(true);
    setError(null);

    try {
      // Using direct tier change (no payment) for testing
      // TODO: Replace with redirectToCheckout(tierIdParam, billingCycle) for Stripe payments
      const response = await changeTier(tierIdParam, billingCycle);
      if (response.success) {
        navigate('/checkout/success');
      } else {
        setError(response.error || 'Failed to change tier');
        setIsCheckingOut(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change tier');
      setIsCheckingOut(false);
    }
  };

  // Loading state
  if (isLoadingTier) {
    return (
      <Box sx={{ bgcolor: 'grey.50', minHeight: '100vh', py: 8 }}>
        <Container maxWidth="md">
          <Skeleton variant="text" width={300} height={60} sx={{ mx: 'auto', mb: 2 }} />
          <Skeleton variant="text" width={200} height={30} sx={{ mx: 'auto', mb: 6 }} />
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 1 }} />
            </Grid>
          </Grid>
        </Container>
      </Box>
    );
  }

  // Error state - no tier found
  if (!selectedTier) {
    return (
      <Box sx={{ bgcolor: 'grey.50', minHeight: '100vh', py: 8 }}>
        <Container maxWidth="sm">
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || 'Tier not found'}
          </Alert>
          <Button variant="contained" onClick={() => navigate('/pricing')}>
            Return to Pricing
          </Button>
        </Container>
      </Box>
    );
  }

  const price = billingCycle === 'monthly' ? selectedTier.price_monthly : selectedTier.price_yearly;
  const yearlyDiscount = selectedTier.price_monthly * 12 - selectedTier.price_yearly;

  return (
    <Box sx={{ bgcolor: 'grey.50', minHeight: '100vh', py: 8 }}>
      <Container maxWidth="md">
        <Typography variant="h3" textAlign="center" gutterBottom>
          Change Your Plan
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 6 }}>
          You're switching to {selectedTier.display_name}
        </Typography>

        <Grid container spacing={4}>
          {/* Order Summary */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Order Summary
                </Typography>

                <Box sx={{ my: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Billing Cycle
                  </Typography>
                  <ToggleButtonGroup
                    value={billingCycle}
                    exclusive
                    onChange={(_, value) => value && setBillingCycle(value)}
                    fullWidth
                  >
                    <ToggleButton value="monthly">Monthly</ToggleButton>
                    <ToggleButton value="yearly">Yearly (Save 17%)</ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography>{selectedTier.display_name} Plan</Typography>
                  <Typography>
                    ${price}/{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </Typography>
                </Box>

                {billingCycle === 'yearly' && yearlyDiscount > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography color="success.main">Yearly Discount</Typography>
                    <Typography color="success.main">-${yearlyDiscount}</Typography>
                  </Box>
                )}

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">Total</Typography>
                  <Typography variant="h6">
                    ${price}/{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </Typography>
                </Box>

                {error && (
                  <Alert severity="error" sx={{ mt: 3 }}>
                    {error}
                  </Alert>
                )}

                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  startIcon={
                    isCheckingOut ? <CircularProgress size={20} color="inherit" /> : <LockIcon />
                  }
                  sx={{ mt: 4 }}
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? 'Updating membership...' : 'Activate Plan'}
                </Button>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  textAlign="center"
                  display="block"
                  sx={{ mt: 2 }}
                >
                  Your plan will be activated immediately. Cancel anytime.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Plan Features */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardContent sx={{ p: 4 }}>
                <Typography variant="h6" gutterBottom>
                  {selectedTier.display_name} includes:
                </Typography>
                <List dense>
                  {selectedTier.features.map((tierFeature) => {
                    const displayText = formatFeatureDisplay(tierFeature);
                    if (!displayText) return null;

                    return (
                      <ListItem key={tierFeature.id} disablePadding sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <CheckIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={displayText} />
                      </ListItem>
                    );
                  })}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
