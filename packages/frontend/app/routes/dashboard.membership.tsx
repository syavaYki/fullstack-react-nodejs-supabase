import type { Route } from './+types/dashboard.membership';
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid2 as Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useLoaderData } from 'react-router';
import { RouterLink } from '~/utils';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import * as membershipApi from '~/api/membership.api';
import type { Membership, MembershipTier, TrialStatus, UserTierWithFeatures } from '~/types';
import { fetchWithCookies } from '~/lib/fetch.server';

export async function loader({ request }: Route.LoaderArgs) {
  const [membership, tiers, trialStatus, features] = await Promise.all([
    fetchWithCookies<Membership & { tier: MembershipTier }>('/api/membership', request),
    fetchWithCookies<MembershipTier[]>('/api/membership/tiers', request),
    fetchWithCookies<TrialStatus>('/api/membership/trial/status', request),
    fetchWithCookies<UserTierWithFeatures>('/api/membership/features', request),
  ]);

  const filteredTiers = tiers
    ? tiers.filter((t) => t.is_active).sort((a, b) => a.sort_order - b.sort_order)
    : [];

  return {
    membership,
    tiers: filteredTiers,
    trialStatus,
    features,
  };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Membership - SaaS Boilerplate' }];
}

export default function MembershipPage() {
  const loaderData = useLoaderData<typeof loader>();

  // Use loader data directly for read-only values
  const { tiers, features } = loaderData;

  // State for mutable values
  const [membership, setMembership] = useState<(Membership & { tier: MembershipTier }) | null>(
    loaderData.membership
  );
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(loaderData.trialStatus);
  const [isLoading, setIsLoading] = useState(!loaderData.membership);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync state when loader data changes (handles hydration)
  useEffect(() => {
    if (loaderData.membership) {
      setMembership(loaderData.membership);
      setIsLoading(false);
    }
    if (loaderData.trialStatus) {
      setTrialStatus(loaderData.trialStatus);
    }
  }, [loaderData.membership, loaderData.trialStatus]);

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    setError(null);

    try {
      const res = await membershipApi.startTrial();
      if (res.success) {
        setSuccess('Trial started successfully!');
        // Refresh data
        const [membershipRes, trialRes] = await Promise.all([
          membershipApi.getMembership(),
          membershipApi.getTrialStatus(),
        ]);
        if (membershipRes.success && membershipRes.data) {
          setMembership(membershipRes.data);
        }
        if (trialRes.success && trialRes.data) {
          setTrialStatus(trialRes.data);
        }
      } else {
        setError(res.error || 'Failed to start trial');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start trial');
    } finally {
      setIsStartingTrial(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getFeatureDisplayValue = (value: unknown): { text: string; enabled: boolean } => {
    if (typeof value === 'boolean') {
      return {
        text: value ? 'Included' : 'Not included',
        enabled: value,
      };
    }
    if (typeof value === 'number') {
      return {
        text: value === -1 ? 'Unlimited' : value.toLocaleString(),
        enabled: value > 0,
      };
    }
    if (typeof value === 'string') {
      return { text: value, enabled: true };
    }
    return { text: String(value), enabled: true };
  };

  const currentTier = membership?.tier;
  const currentPrice = currentTier?.price_monthly || 0;

  // Find the next higher priced tier (excluding trial)
  const nextUpgradeTier = tiers.find(
    (t) => t.name !== 'trial' && (t.price_monthly || 0) > currentPrice
  );
  const otherTiers = nextUpgradeTier ? [nextUpgradeTier] : [];

  // Show loading until data is ready
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Membership
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Manage your subscription and plan
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* Current Plan */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              height: '100%',
              border: 2,
              borderColor: 'primary.main',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h5">{currentTier?.display_name || 'Free'} Plan</Typography>
                <Chip
                  label={trialStatus?.is_on_trial ? 'Trial' : 'Current Plan'}
                  color={trialStatus?.is_on_trial ? 'warning' : 'primary'}
                />
              </Box>
              <Typography variant="h3" gutterBottom>
                {formatPrice(
                  membership?.billing_cycle === 'yearly'
                    ? currentTier?.price_yearly || 0
                    : currentTier?.price_monthly || 0
                )}
                <Typography component="span" variant="h6" color="text.secondary">
                  /{membership?.billing_cycle === 'yearly' ? 'year' : 'month'}
                </Typography>
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {trialStatus?.is_on_trial && trialStatus.trial_ends_at ? (
                  <>Trial ends {formatDate(trialStatus.trial_ends_at)}</>
                ) : membership?.next_billing_date ? (
                  <>
                    {membership.status === 'active'
                      ? `Next billing date: ${formatDate(membership.next_billing_date)}`
                      : membership.status === 'cancelled'
                        ? `Access until: ${formatDate(membership.next_billing_date)}`
                        : `Status: ${membership.status}`}
                  </>
                ) : currentTier?.price_monthly === 0 ? (
                  'Free forever'
                ) : (
                  currentTier?.description || ''
                )}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Your plan includes:
              </Typography>
              {features?.features && Object.keys(features.features).length > 0 ? (
                <List dense>
                  {Object.entries(features.features).map(([key, value]) => {
                    const display = getFeatureDisplayValue(value);
                    return (
                      <ListItem key={key} disablePadding sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {display.enabled ? (
                            <CheckIcon color="success" fontSize="small" />
                          ) : (
                            <CloseIcon color="disabled" fontSize="small" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                          secondary={typeof value !== 'boolean' ? display.text : undefined}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No features configured for this plan.
                </Typography>
              )}
              <Button
                component={RouterLink}
                to="/dashboard/billing"
                variant="outlined"
                fullWidth
                sx={{ mt: 2 }}
              >
                Manage Subscription
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Upgrade Options */}
        {otherTiers.slice(0, 1).map((tier) => {
          const isUpgrade = (tier.price_monthly || 0) > (currentTier?.price_monthly || 0);
          return (
            <Grid size={{ xs: 12, md: 6 }} key={tier.id}>
              <Card sx={{ height: '100%', bgcolor: 'grey.50' }}>
                <CardContent sx={{ p: 4 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 2,
                    }}
                  >
                    <Typography variant="h5">{tier.display_name} Plan</Typography>
                    <Chip
                      label={isUpgrade ? 'Upgrade' : 'Downgrade'}
                      variant="outlined"
                      color={isUpgrade ? 'primary' : 'default'}
                    />
                  </Box>
                  <Typography variant="h3" gutterBottom>
                    {formatPrice(tier.price_monthly)}
                    <Typography component="span" variant="h6" color="text.secondary">
                      /month
                    </Typography>
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {tier.description || (isUpgrade ? 'Get more features' : 'Basic features')}
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    {isUpgrade
                      ? `Everything in ${currentTier?.display_name || 'Free'}, plus more:`
                      : 'Includes:'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>
                    View full feature comparison on our pricing page.
                  </Typography>
                  <Button
                    component={RouterLink}
                    to={`/checkout?tier=${tier.id}&cycle=monthly`}
                    variant="contained"
                    fullWidth
                    sx={{ mt: 2 }}
                  >
                    {isUpgrade
                      ? `Upgrade to ${tier.display_name}`
                      : `Switch to ${tier.display_name}`}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}

        {otherTiers.length === 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%', bgcolor: 'grey.50' }}>
              <CardContent
                sx={{
                  p: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 300,
                }}
              >
                <Typography variant="body1" color="text.secondary" textAlign="center">
                  You're on our top plan. Thank you for your support!
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Trial Status */}
      <Card sx={{ mt: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" gutterBottom>
            Trial Status
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            {trialStatus?.is_on_trial ? (
              <>
                <Chip label="On Trial" color="warning" />
                <Typography variant="body2" color="text.secondary">
                  {trialStatus.days_remaining} day
                  {trialStatus.days_remaining !== 1 ? 's' : ''} remaining. Trial ends{' '}
                  {formatDate(trialStatus.trial_ends_at)}.
                </Typography>
                <Button component={RouterLink} to="/pricing" variant="contained" size="small">
                  Upgrade Now
                </Button>
              </>
            ) : trialStatus?.can_start_trial ? (
              <>
                <Chip label="Trial Available" color="success" />
                <Typography variant="body2" color="text.secondary">
                  Start your 14-day free trial to access all premium features.
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleStartTrial}
                  disabled={isStartingTrial}
                  startIcon={
                    isStartingTrial ? <CircularProgress size={16} color="inherit" /> : null
                  }
                >
                  {isStartingTrial ? 'Starting...' : 'Start Free Trial'}
                </Button>
              </>
            ) : (
              <>
                <Chip label="Trial Used" color="default" />
                <Typography variant="body2" color="text.secondary">
                  You have already used your 14-day free trial.
                </Typography>
              </>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* All Plans Link */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button component={RouterLink} to="/pricing" variant="text">
          View all plans and pricing
        </Button>
      </Box>
    </Box>
  );
}
