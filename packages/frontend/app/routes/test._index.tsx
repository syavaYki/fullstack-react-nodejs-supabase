import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Alert,
  Chip,
  Grid2 as Grid,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import LockIcon from '@mui/icons-material/Lock';
import StarIcon from '@mui/icons-material/Star';
import DiamondIcon from '@mui/icons-material/Diamond';
import { apiClient } from '~/api/client';

interface TestResult {
  success: boolean;
  data?: {
    feature: string;
    tier: string;
    message: string;
  };
  error?: string;
}

interface TierInfo {
  tier_name: string;
  tier_display_name: string;
  membership_status: string;
  features: Record<string, unknown>;
}

const featureTests = [
  {
    id: 'free',
    title: 'Free Feature',
    description: 'Accessible by Free, Premium, and Pro tiers',
    endpoint: '/api/test/free-feature',
    icon: <LockIcon />,
    allowedTiers: ['free', 'premium', 'pro'],
    color: 'inherit' as const,
  },
  {
    id: 'premium',
    title: 'Premium Feature',
    description: 'Accessible by Premium and Pro tiers only',
    endpoint: '/api/test/premium-feature',
    icon: <StarIcon />,
    allowedTiers: ['premium', 'pro'],
    color: 'primary' as const,
  },
  {
    id: 'pro',
    title: 'Pro Feature',
    description: 'Accessible by Pro tier only',
    endpoint: '/api/test/pro-feature',
    icon: <DiamondIcon />,
    allowedTiers: ['pro'],
    color: 'secondary' as const,
  },
];

export default function TestIndexPage() {
  const [results, setResults] = useState<Record<string, TestResult | null>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [tierLoading, setTierLoading] = useState(true);

  useEffect(() => {
    fetchTierInfo();
  }, []);

  const fetchTierInfo = async () => {
    setTierLoading(true);
    try {
      const response = await apiClient.get<TierInfo>('/api/test/tier-info');
      if (response.success && response.data) {
        setTierInfo(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch tier info:', error);
    } finally {
      setTierLoading(false);
    }
  };

  const testFeature = async (featureId: string, endpoint: string) => {
    setLoading((prev) => ({ ...prev, [featureId]: true }));
    setResults((prev) => ({ ...prev, [featureId]: null }));

    try {
      const response = await apiClient.get<TestResult['data']>(endpoint);
      setResults((prev) => ({
        ...prev,
        [featureId]: response as TestResult,
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [featureId]: { success: false, error: 'Network error' },
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [featureId]: false }));
    }
  };

  const shouldHaveAccess = (allowedTiers: string[]) => {
    if (!tierInfo) return false;
    return allowedTiers.includes(tierInfo.tier_name);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Tier Access Test
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Test which features your current membership tier can access.
      </Typography>

      {/* Current Tier Info */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Your Current Tier
          </Typography>
          {tierLoading ? (
            <CircularProgress size={24} />
          ) : tierInfo ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={tierInfo.tier_display_name}
                color="primary"
                size="medium"
                sx={{ fontWeight: 600 }}
              />
              <Chip label={tierInfo.membership_status} variant="outlined" size="small" />
            </Box>
          ) : (
            <Alert severity="warning">Unable to fetch tier information</Alert>
          )}
        </CardContent>
      </Card>

      {/* Feature Test Cards */}
      <Grid container spacing={3}>
        {featureTests.map((feature) => {
          const result = results[feature.id];
          const isLoading = loading[feature.id];
          const expectedAccess = shouldHaveAccess(feature.allowedTiers);

          return (
            <Grid size={{ xs: 12, md: 4 }} key={feature.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    {feature.icon}
                    <Typography variant="h6">{feature.title}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {feature.description}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
                    {feature.allowedTiers.map((tier) => (
                      <Chip
                        key={tier}
                        label={tier}
                        size="small"
                        variant={tierInfo?.tier_name === tier ? 'filled' : 'outlined'}
                        color={tierInfo?.tier_name === tier ? 'primary' : 'default'}
                      />
                    ))}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Expected: {expectedAccess ? 'Access Granted' : 'Access Denied'}
                  </Typography>

                  {/* Result Display */}
                  {result && (
                    <Alert
                      severity={result.success ? 'success' : 'error'}
                      icon={result.success ? <CheckCircleIcon /> : <BlockIcon />}
                      sx={{ mt: 2 }}
                    >
                      {result.success ? result.data?.message : result.error || 'Access denied'}
                    </Alert>
                  )}
                </CardContent>
                <CardActions sx={{ p: 2, pt: 0 }}>
                  <Button
                    variant="contained"
                    color={feature.color}
                    onClick={() => testFeature(feature.id, feature.endpoint)}
                    disabled={isLoading}
                    fullWidth
                  >
                    {isLoading ? <CircularProgress size={24} /> : 'Test Access'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Legend */}
      <Box sx={{ mt: 4, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Expected Behavior:
        </Typography>
        <Typography variant="body2" color="text.secondary">
          <strong>Free tier:</strong> Can access Free Feature only
          <br />
          <strong>Premium tier:</strong> Can access Free + Premium Features
          <br />
          <strong>Pro tier:</strong> Can access all Features (Free + Premium + Pro)
        </Typography>
      </Box>
    </Box>
  );
}
