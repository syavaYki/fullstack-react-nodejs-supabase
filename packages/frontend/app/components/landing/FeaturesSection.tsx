/**
 * @file FeaturesSection.tsx
 * @description Features grid showcasing product capabilities.
 */

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import PaymentIcon from '@mui/icons-material/Payment';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TuneIcon from '@mui/icons-material/Tune';
import SupportIcon from '@mui/icons-material/Support';

const FEATURES = [
  {
    icon: <SecurityIcon sx={{ fontSize: 40 }} />,
    title: 'Secure Authentication',
    description:
      'Enterprise-grade auth with Supabase. Email/password, magic links, and OAuth ready.',
  },
  {
    icon: <PaymentIcon sx={{ fontSize: 40 }} />,
    title: 'Stripe Billing',
    description: 'Subscriptions, checkout, customer portal, and webhook handling out of the box.',
  },
  {
    icon: <TuneIcon sx={{ fontSize: 40 }} />,
    title: 'Feature Gating',
    description:
      'Boolean, limit, and enum features per tier. Usage tracking with auto-reset periods.',
  },
  {
    icon: <DashboardIcon sx={{ fontSize: 40 }} />,
    title: 'Dashboard Ready',
    description: 'Responsive dashboard with sidebar navigation, profile management, and billing.',
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 40 }} />,
    title: 'Performance First',
    description: 'Vite-powered SPA with code splitting, MUI theming, and optimized bundle size.',
  },
  {
    icon: <SupportIcon sx={{ fontSize: 40 }} />,
    title: 'Production Patterns',
    description:
      'Error handling, rate limiting, input validation, and security best practices baked in.',
  },
];

export default function FeaturesSection() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Typography variant="h3" fontWeight={700} align="center" gutterBottom>
          Everything You Need
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          align="center"
          sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}
        >
          Skip months of boilerplate. Start with a complete, tested foundation.
        </Typography>

        <Grid container spacing={3}>
          {FEATURES.map((feature) => (
            <Grid key={feature.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 4 },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
