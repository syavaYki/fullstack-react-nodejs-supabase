/**
 * @file PricingSection.tsx
 * @description Pricing section with DB-fetched tiers and monthly/yearly toggle.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Skeleton from '@mui/material/Skeleton';
import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { getPublicTiersWithFeatures } from '~/api/membership.api';
import { redirectToCheckout } from '~/api/billing.api';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';
import type { MembershipTier, TierFeatureWithDetails, BillingCycle } from '~/types';
import FadeInSection from '~/components/animations/FadeInSection.js';

type TierWithFeatures = MembershipTier & {
  features: TierFeatureWithDetails[];
};

function isFeatureEnabled(tf: TierFeatureWithDetails): boolean {
  const featureType = tf.feature?.feature_type;
  const val = tf.value;
  if (featureType === 'boolean') return val === true || val === 'true';
  if (featureType === 'limit') {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    return num !== 0;
  }
  return !!val;
}

function getFeatureLabel(tf: TierFeatureWithDetails): string {
  const featureType = tf.feature?.feature_type;
  const name = tf.feature?.name ?? '';
  const val = tf.value;
  if (featureType === 'limit') {
    const num = typeof val === 'number' ? val : parseInt(String(val), 10);
    if (num === -1) return `Unlimited ${name}`;
    return `${num} ${name}`;
  }
  return name;
}

export default function PricingSection() {
  const [tiers, setTiers] = useState<TierWithFeatures[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    getPublicTiersWithFeatures().then((res) => {
      if (res.success && res.data) setTiers(res.data as TierWithFeatures[]);
      setLoading(false);
    });
  }, []);

  return (
    <Box id="pricing" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'grey.50' }}>
      <Container maxWidth="lg">
        <FadeInSection direction="up">
          <Typography variant="h3" fontWeight={700} align="center" gutterBottom>
            Simple Pricing
          </Typography>
          <Typography variant="h6" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Choose the plan that fits your needs.
          </Typography>
        </FadeInSection>

        <FadeInSection direction="up" delay={0.1}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
            <ToggleButtonGroup
              value={cycle}
              exclusive
              onChange={(_, val) => val && setCycle(val)}
              size="small"
            >
              <ToggleButton value="monthly">Monthly</ToggleButton>
              <ToggleButton value="yearly">
                Yearly
                <Chip label="Save 15%" size="small" color="success" sx={{ ml: 1 }} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </FadeInSection>

        {loading ? (
          <Grid container spacing={3} justifyContent="center">
            {[1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, md: 4 }}>
                <Skeleton variant="rounded" height={400} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={3} justifyContent="center">
            {tiers.map((tier, index) => {
              const price = cycle === 'monthly' ? tier.price_monthly : tier.price_yearly;
              const isPopular = index === 1;

              return (
                <Grid key={tier.id} size={{ xs: 12, md: 4 }}>
                  <FadeInSection direction="up" delay={index * 0.1}>
                    <motion.div whileHover={{ y: -6, scale: 1.02 }} transition={{ duration: 0.2 }}>
                      <Card
                        variant={isPopular ? 'elevation' : 'outlined'}
                        elevation={isPopular ? 8 : 0}
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          position: 'relative',
                          ...(isPopular && {
                            borderColor: 'primary.main',
                            borderWidth: 2,
                            borderStyle: 'solid',
                          }),
                        }}
                      >
                        {isPopular && (
                          <Chip
                            label="Most Popular"
                            color="primary"
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: -12,
                              left: '50%',
                              transform: 'translateX(-50%)',
                            }}
                          />
                        )}
                        <CardContent sx={{ flex: 1, pt: isPopular ? 4 : 3 }}>
                          <Typography variant="h5" fontWeight={700} gutterBottom>
                            {tier.display_name}
                          </Typography>
                          {price > 0 ? (
                            <motion.div
                              key={tier.id + cycle}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.25 }}
                            >
                              <Box sx={{ mb: 2 }}>
                                <Typography
                                  variant="h3"
                                  fontWeight={700}
                                  color="primary"
                                  component="span"
                                >
                                  ${price}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" component="span">
                                  /{cycle === 'monthly' ? 'mo' : 'yr'}
                                </Typography>
                              </Box>
                            </motion.div>
                          ) : (
                            <Typography
                              variant="h3"
                              fontWeight={700}
                              color="primary"
                              sx={{ mb: 2 }}
                            >
                              Free
                            </Typography>
                          )}

                          {tier.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {tier.description}
                            </Typography>
                          )}

                          <List dense>
                            {tier.features.filter(isFeatureEnabled).map((f) => (
                              <ListItem key={f.id} disableGutters>
                                <ListItemIcon sx={{ minWidth: 28 }}>
                                  <CheckCircleIcon fontSize="small" color="success" />
                                </ListItemIcon>
                                <ListItemText primary={getFeatureLabel(f)} />
                              </ListItem>
                            ))}
                          </List>
                        </CardContent>

                        <CardActions sx={{ p: 2 }}>
                          {price > 0 ? (
                            <Button
                              fullWidth
                              variant={isPopular ? 'contained' : 'outlined'}
                              size="large"
                              onClick={() => redirectToCheckout(tier.id, cycle)}
                            >
                              Get Started
                            </Button>
                          ) : (
                            <Button
                              fullWidth
                              variant="outlined"
                              size="large"
                              component={RouterLink}
                              to={SITE_MAP.register}
                            >
                              Sign Up Free
                            </Button>
                          )}
                        </CardActions>
                      </Card>
                    </motion.div>
                  </FadeInSection>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>
    </Box>
  );
}
