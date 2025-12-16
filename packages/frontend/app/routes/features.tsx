import { useState } from 'react';
import type { Route } from './+types/features';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Grid2 as Grid,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import { useLoaderData } from 'react-router';
import { RouterLink } from '~/utils';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { getPublicTiersWithFeatures } from '../api/membership.api';
import { isFeatureAvailable, formatFeatureValue } from '~/utils';

// Loader: fetches data before rendering
export async function loader() {
  const response = await getPublicTiersWithFeatures();

  if (!response.success || !response.data) {
    throw new Response('Failed to load features', {
      status: 500,
    });
  }

  // Sort by sort_order and filter out trial tier
  const tiers = response.data
    .filter((tier) => tier.name !== 'trial')
    .sort((a, b) => a.sort_order - b.sort_order);

  return { tiers };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Features - SaaS Boilerplate' },
    {
      name: 'description',
      content: 'Explore features across all membership tiers',
    },
  ];
}

export default function FeaturesPage() {
  const { tiers } = useLoaderData<typeof loader>();
  const [selectedTab, setSelectedTab] = useState(0);

  if (!tiers || tiers.length === 0) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 4 }}>
          No features available
        </Alert>
        <Button component={RouterLink} to="/pricing" variant="contained">
          View Pricing
        </Button>
      </Container>
    );
  }

  const currentTier = tiers[selectedTab];

  return (
    <>
      {/* Header Section */}
      <Box sx={{ bgcolor: 'grey.50', py: 1 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h2" gutterBottom>
              Features
            </Typography>

            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}
            >
              Compare features across all membership tiers and find the perfect plan for your needs
            </Typography>
          </Box>

          {/* Tier Tabs */}
          <Box
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Tabs
              value={selectedTab}
              onChange={(_, newValue) => setSelectedTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ maxWidth: '100%' }}
            >
              {tiers.map((tier) => (
                <Tab
                  key={tier.id}
                  label={
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      {tier.display_name}
                      {tier.price_monthly > 0 && (
                        <Chip label={`$${tier.price_monthly}/mo`} size="small" variant="outlined" />
                      )}
                    </Box>
                  }
                  sx={{
                    textTransform: 'none',
                    fontSize: '1rem',
                    py: 2,
                  }}
                />
              ))}
            </Tabs>
          </Box>
        </Container>
      </Box>

      {/* Features Grid */}
      <Container maxWidth="lg" sx={{ py: 2 }}>
        {/* Tier Info */}
        <Box sx={{ mb: 6 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              mb: 2,
            }}
          >
            <Typography variant="h4">{currentTier.display_name}</Typography>
            {currentTier.price_monthly === 0 ? (
              <Chip label="Free" color="success" />
            ) : (
              <Chip
                label={`$${currentTier.price_monthly}/month or $${currentTier.price_yearly}/year`}
                color="primary"
              />
            )}
          </Box>
          {currentTier.description && (
            <Typography variant="body1" color="text.secondary">
              {currentTier.description}
            </Typography>
          )}
        </Box>

        {/* Features Cards */}
        <Grid container spacing={3}>
          {currentTier.features.map((tierFeature) => {
            const feature = tierFeature.feature;
            if (!feature) return null;

            const available = isFeatureAvailable(tierFeature);
            const displayValue = formatFeatureValue(tierFeature);

            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={tierFeature.id}>
                <Card
                  sx={{
                    height: '100%',
                    opacity: available ? 1 : 0.6,
                    borderLeft: 4,
                    borderColor: available ? 'success.main' : 'grey.300',
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 2,
                      }}
                    >
                      {available ? <CheckIcon color="success" /> : <CloseIcon color="disabled" />}
                      <Typography variant="h6">{feature.name}</Typography>
                    </Box>

                    {feature.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {feature.description}
                      </Typography>
                    )}

                    <Chip
                      label={displayValue}
                      size="small"
                      color={available ? 'primary' : 'default'}
                      variant={available ? 'filled' : 'outlined'}
                    />
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        {/* CTA Section */}
        <Box
          sx={{
            textAlign: 'center',
            py: 2,
            bgcolor: 'grey.50',
            borderRadius: 2,
          }}
        >
          <Typography variant="h4" gutterBottom>
            Ready to Get Started?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Choose the plan that's right for you and start building today.
          </Typography>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Button component={RouterLink} to="/pricing" variant="contained" size="large">
              View Pricing
            </Button>
            <Button component={RouterLink} to="/auth/register" variant="outlined" size="large">
              Get Started Free
            </Button>
          </Box>
        </Box>
      </Container>
    </>
  );
}
