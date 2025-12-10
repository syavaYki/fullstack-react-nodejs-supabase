import type { Route } from './+types/_index';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid2 as Grid,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import { Link } from 'react-router';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import PaymentIcon from '@mui/icons-material/Payment';
import GroupIcon from '@mui/icons-material/Group';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'SaaS Boilerplate - Build Your Product Faster' },
    {
      name: 'description',
      content:
        'Full-stack SaaS boilerplate with authentication, billing, and membership management.',
    },
  ];
}

const features = [
  {
    icon: <SecurityIcon sx={{ fontSize: 40 }} />,
    title: 'Secure Authentication',
    description:
      'Built-in email/password authentication with Supabase. Secure session management with cookies.',
  },
  {
    icon: <PaymentIcon sx={{ fontSize: 40 }} />,
    title: 'Stripe Billing',
    description:
      'Subscription management, checkout, and customer portal integration out of the box.',
  },
  {
    icon: <GroupIcon sx={{ fontSize: 40 }} />,
    title: 'Membership Tiers',
    description: 'Flexible tier system with features and usage limits. Trial periods and upgrades.',
  },
  {
    icon: <SpeedIcon sx={{ fontSize: 40 }} />,
    title: 'Server-Side Rendering',
    description: 'React Router v7 with SSR for fast initial loads and great SEO.',
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <RocketLaunchIcon />
                  <Typography variant="overline" sx={{ letterSpacing: 2 }}>
                    SaaS Boilerplate
                  </Typography>
                </Box>
                <Typography variant="h1" sx={{ fontSize: { xs: '2.5rem', md: '3.5rem' } }}>
                  Build Your SaaS Product Faster
                </Typography>
                <Typography variant="h5" sx={{ opacity: 0.9, fontWeight: 400 }}>
                  A production-ready full-stack template with authentication, billing, and
                  membership management built-in.
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    component={Link}
                    to="/auth/register"
                    variant="contained"
                    size="large"
                    sx={{
                      bgcolor: 'white',
                      color: 'primary.main',
                      '&:hover': { bgcolor: 'grey.100' },
                    }}
                  >
                    Get Started Free
                  </Button>
                  <Button
                    component={Link}
                    to="/pricing"
                    variant="outlined"
                    size="large"
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
                    }}
                  >
                    View Pricing
                  </Button>
                </Stack>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  borderRadius: 3,
                  p: 4,
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Tech Stack
                </Typography>
                <Grid container spacing={2}>
                  {['React 19', 'TypeScript', 'MUI v6', 'Supabase', 'Stripe', 'Express.js'].map(
                    (tech) => (
                      <Grid size={6} key={tech}>
                        <Box
                          sx={{
                            bgcolor: 'rgba(255,255,255,0.15)',
                            borderRadius: 1,
                            py: 1,
                            px: 2,
                            textAlign: 'center',
                          }}
                        >
                          {tech}
                        </Box>
                      </Grid>
                    )
                  )}
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h2" gutterBottom>
            Everything You Need
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
            Focus on your unique features while we handle the infrastructure.
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {features.map((feature) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feature.title}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent sx={{ textAlign: 'center', p: 4 }}>
                  <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h5" gutterBottom>
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

      {/* CTA Section */}
      <Box sx={{ bgcolor: 'grey.50', py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography variant="h3" gutterBottom>
            Ready to Get Started?
          </Typography>
          <Typography variant="h6" color="text.secondary" paragraph>
            Start building your SaaS product today with our free tier.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button component={Link} to="/auth/register" variant="contained" size="large">
              Start Free Trial
            </Button>
            <Button component={Link} to="/contact" variant="outlined" size="large">
              Contact Sales
            </Button>
          </Stack>
        </Container>
      </Box>
    </>
  );
}
