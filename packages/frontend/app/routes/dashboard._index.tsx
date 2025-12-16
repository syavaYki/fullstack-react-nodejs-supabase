import type { Route } from './+types/dashboard._index';
import { useState, useEffect } from 'react';
import {
  Grid2 as Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  LinearProgress,
  Chip,
  Stack,
  CircularProgress,
} from '@mui/material';
import { useLoaderData } from 'react-router';
import { RouterLink } from '~/utils';
import { useAuth } from '~/contexts';
import type {
  UserProfile,
  Membership,
  MembershipTier,
  TrialStatus,
  UsageSummary,
  FeatureUsage,
} from '~/types';
import { fetchWithCookies } from '~/lib/fetch.server';

export async function loader({ request }: Route.LoaderArgs) {
  const [profile, membership, trialStatus, usage] = await Promise.all([
    fetchWithCookies<UserProfile>('/api/profile', request),
    fetchWithCookies<Membership & { tier: MembershipTier }>('/api/membership', request),
    fetchWithCookies<TrialStatus>('/api/membership/trial/status', request),
    fetchWithCookies<UsageSummary>('/api/membership/usage', request),
  ]);

  return { profile, membership, trialStatus, usage };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: 'Dashboard - SaaS Boilerplate' }];
}

export default function DashboardIndex() {
  const { user } = useAuth();
  const loaderData = useLoaderData<typeof loader>();

  // State for values that might need to update
  const [profile, setProfile] = useState<UserProfile | null>(loaderData.profile);
  const [membership, setMembership] = useState<(Membership & { tier: MembershipTier }) | null>(
    loaderData.membership
  );
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(loaderData.trialStatus);
  const [usage, setUsage] = useState<UsageSummary | null>(loaderData.usage);
  const [isLoading, setIsLoading] = useState(!loaderData.profile && !loaderData.membership);

  // Sync state when loader data changes (handles hydration)
  useEffect(() => {
    if (loaderData.profile) {
      setProfile(loaderData.profile);
    }
    if (loaderData.membership) {
      setMembership(loaderData.membership);
    }
    if (loaderData.trialStatus) {
      setTrialStatus(loaderData.trialStatus);
    }
    if (loaderData.usage) {
      setUsage(loaderData.usage);
    }
    setIsLoading(false);
  }, [loaderData.profile, loaderData.membership, loaderData.trialStatus, loaderData.usage]);

  const userName = profile?.first_name || user?.email?.split('@')[0] || 'there';
  const tierName = membership?.tier?.display_name || 'Free';
  const isOnTrial = trialStatus?.is_on_trial ?? false;
  const trialDaysRemaining = trialStatus?.days_remaining ?? 0;

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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Welcome back, {userName}!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your account today.
        </Typography>
      </Box>

      {/* Trial Banner */}
      {isOnTrial && trialDaysRemaining > 0 && (
        <Card sx={{ mb: 4, bgcolor: 'primary.50', border: 1, borderColor: 'primary.200' }}>
          <CardContent
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Box>
              <Typography variant="h6" color="primary.main">
                You're on a free trial
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining. Upgrade now
                to keep your premium features.
              </Typography>
            </Box>
            <Button component={RouterLink} to="/pricing" variant="contained">
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Usage Stats Grid */}
      {usage && usage.features.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {usage.features.slice(0, 4).map((feature: FeatureUsage) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feature.feature_key}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {feature.feature_name}
                    </Typography>
                    {feature.is_exceeded && <Chip label="Exceeded" size="small" color="error" />}
                  </Box>
                  <Typography variant="h4" gutterBottom>
                    {feature.current_usage.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    of {feature.usage_limit.toLocaleString()}{' '}
                    {feature.period_type !== 'none' && `(${feature.period_type})`}
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(feature.percentage_used ?? 0, 100)}
                    color={feature.is_exceeded ? 'error' : 'primary'}
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Main Content */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Usage Overview
              </Typography>
              {usage && usage.features.length > 0 ? (
                <Stack spacing={3} sx={{ mt: 3 }}>
                  {usage.features.map((feature: FeatureUsage) => (
                    <Box key={feature.feature_key}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{feature.feature_name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {feature.current_usage.toLocaleString()} /{' '}
                          {feature.usage_limit.toLocaleString()}
                          {feature.period_resets_at && (
                            <> · Resets {formatDate(feature.period_resets_at)}</>
                          )}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(feature.percentage_used ?? 0, 100)}
                        color={feature.is_exceeded ? 'error' : 'primary'}
                      />
                    </Box>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No usage data available yet.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Plan
              </Typography>
              <Box sx={{ my: 3 }}>
                <Chip label={tierName} color={isOnTrial ? 'warning' : 'primary'} />
                {membership?.tier && (
                  <>
                    <Typography variant="h4" sx={{ mt: 2 }}>
                      {membership.billing_cycle === 'yearly'
                        ? `${formatPrice(membership.tier.price_yearly)}/yr`
                        : `${formatPrice(membership.tier.price_monthly)}/mo`}
                    </Typography>
                    {membership.next_billing_date && (
                      <Typography variant="body2" color="text.secondary">
                        {membership.status === 'active'
                          ? `Renews on ${formatDate(membership.next_billing_date)}`
                          : membership.status === 'cancelled'
                            ? `Access until ${formatDate(membership.next_billing_date)}`
                            : `Status: ${membership.status}`}
                      </Typography>
                    )}
                  </>
                )}
                {isOnTrial && trialStatus?.trial_ends_at && (
                  <Typography variant="body2" color="text.secondary">
                    Trial ends {formatDate(trialStatus.trial_ends_at)}
                  </Typography>
                )}
              </Box>
              <Stack spacing={2}>
                <Button component={RouterLink} to="/dashboard/billing" variant="outlined" fullWidth>
                  Manage Subscription
                </Button>
                {(!membership?.tier || membership.tier.price_monthly === 0) && (
                  <Button component={RouterLink} to="/pricing" variant="contained" fullWidth>
                    Upgrade Plan
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
