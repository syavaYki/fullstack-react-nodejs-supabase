import { useState, useEffect } from 'react';
import type { Route } from './+types/pricing';
import {
  Box,
  Container,
  Typography,
  Grid2 as Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useLoaderData } from 'react-router';
import { RouterLink } from '~/utils';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '~/contexts';
import { getMembership, type TierWithFeatures } from '~/api/membership.api';
import type { Membership, MembershipTier } from '~/types';
import { isFeatureAvailable, formatFeatureDisplay } from '~/utils';

const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Loader: fetch tiers (public, no auth needed)
export async function loader() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/membership/public/tiers-with-features`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();

    if (!data.success || !data.data) {
      throw new Response('Failed to load pricing data', { status: 500 });
    }

    // Filter out trial tier and sort by sort_order
    const tiers = (data.data as TierWithFeatures[])
      .filter((tier) => tier.name !== 'trial')
      .sort((a, b) => a.sort_order - b.sort_order);

    return { tiers };
  } catch (error) {
    console.error('[Pricing Loader] Error:', error);
    throw new Response('Failed to load pricing data', { status: 500 });
  }
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Pricing - SaaS Boilerplate' },
    { name: 'description', content: "Choose the plan that's right for you." },
  ];
}

export default function PricingPage() {
  const { tiers } = useLoaderData<typeof loader>();
  const { isAuthenticated } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [userMembership, setUserMembership] = useState<
    (Membership & { tier: MembershipTier }) | null
  >(null);
  const [loadingMembership, setLoadingMembership] = useState(false);

  // Fetch user's membership if logged in
  useEffect(() => {
    if (isAuthenticated) {
      setLoadingMembership(true);
      getMembership()
        .then((res) => {
          if (res.success && res.data) {
            setUserMembership(res.data);
          }
        })
        .finally(() => setLoadingMembership(false));
    } else {
      setUserMembership(null);
    }
  }, [isAuthenticated]);

  // Check if tier is user's current tier
  const isCurrentTier = (tier: TierWithFeatures) => {
    return userMembership?.tier?.id === tier.id;
  };

  // Get CTA button props based on auth state and tier
  const getCtaProps = (tier: TierWithFeatures) => {
    if (!isAuthenticated) {
      return {
        to: '/auth/register',
        label: tier.price_monthly === 0 ? 'Get Started Free' : 'Get Started',
        variant: 'contained' as const,
        disabled: false,
      };
    }

    if (isCurrentTier(tier)) {
      return {
        to: '#',
        label: 'Your Current',
        variant: 'outlined' as const,
        disabled: true,
      };
    }

    // Determine if upgrade or downgrade based on sort_order
    const currentTierOrder = userMembership?.tier?.sort_order ?? 0;
    const targetTierOrder = tier.sort_order;
    const isUpgrade = targetTierOrder > currentTierOrder;

    // Both upgrades and downgrades go through checkout (direct tier change)
    return {
      to: `/checkout?tier=${tier.id}&cycle=${billingCycle}`,
      label: isUpgrade ? 'Upgrade' : 'Downgrade',
      variant: isUpgrade ? ('contained' as const) : ('outlined' as const),
      disabled: false,
    };
  };

  if (!tiers || tiers.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Alert severity="error">Failed to load pricing information</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
      <Box sx={{ textAlign: 'center', mb: 8 }}>
        <Typography variant="h2" gutterBottom>
          Simple, Transparent Pricing
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          Choose the plan that's right for you
        </Typography>
        <ToggleButtonGroup
          value={billingCycle}
          exclusive
          onChange={(_, value) => value && setBillingCycle(value)}
          sx={{ bgcolor: 'grey.100', borderRadius: 2, p: 0.5 }}
        >
          <ToggleButton value="monthly" sx={{ px: 3, borderRadius: 1.5 }}>
            Monthly
          </ToggleButton>
          <ToggleButton value="yearly" sx={{ px: 3, borderRadius: 1.5 }}>
            Yearly
            <Chip label="Save 17%" size="small" color="success" sx={{ ml: 1 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loadingMembership && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      <Grid container spacing={4} justifyContent="center">
        {tiers.map((tier) => {
          const isCurrent = isCurrentTier(tier);
          const ctaProps = getCtaProps(tier);
          const price = billingCycle === 'monthly' ? tier.price_monthly : tier.price_yearly;

          return (
            <Grid size={{ xs: 12, md: 4 }} key={tier.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: isCurrent ? 3 : 1,
                  borderColor: isCurrent ? 'success.main' : 'divider',
                  transform: isCurrent ? 'scale(1.02)' : 'none',
                  boxShadow: isCurrent ? 8 : 1,
                }}
              >
                {isCurrent && (
                  <Chip
                    label="Current Plan"
                    color="success"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -12,
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }}
                  />
                )}
                <CardContent sx={{ flexGrow: 1, p: 4 }}>
                  <Typography variant="h5" gutterBottom>
                    {tier.display_name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {tier.description || `Perfect for ${tier.name} users`}
                  </Typography>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h3" component="span" sx={{ fontWeight: 700 }}>
                      ${price}
                    </Typography>
                    <Typography variant="body1" component="span" color="text.secondary">
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </Typography>
                  </Box>
                  <List dense>
                    {tier.features.map((tierFeature) => {
                      const available = isFeatureAvailable(tierFeature);
                      const displayText = formatFeatureDisplay(tierFeature);

                      if (!displayText) return null;

                      return (
                        <ListItem key={tierFeature.id} disablePadding sx={{ py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 32 }}>
                            {available ? (
                              <CheckIcon color="success" fontSize="small" />
                            ) : (
                              <CloseIcon color="disabled" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={displayText}
                            primaryTypographyProps={{
                              variant: 'body2',
                              color: available ? 'text.primary' : 'text.disabled',
                            }}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </CardContent>
                <CardActions sx={{ p: 4, pt: 0 }}>
                  <Button
                    component={ctaProps.disabled ? 'button' : RouterLink}
                    to={ctaProps.disabled ? undefined : ctaProps.to}
                    variant={ctaProps.variant}
                    size="large"
                    fullWidth
                    color={isCurrent ? 'success' : 'primary'}
                    disabled={ctaProps.disabled}
                  >
                    {ctaProps.label}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Features link */}
      <Box sx={{ textAlign: 'center', mt: 6 }}>
        <Button component={RouterLink} to="/features" variant="text" size="large">
          Compare all features in detail
        </Button>
      </Box>
    </Container>
  );
}
