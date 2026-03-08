import { motion } from 'framer-motion';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid2';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';
import { branding } from '@config/branding';
import { GRADIENTS } from '~/theme/index.js';
import FloatingElement from '~/components/animations/FloatingElement.js';

const ease = [0.22, 1, 0.36, 1] as const;

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease },
  };
}

function DashboardMockup() {
  return (
    <Card
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(37,99,235,0.15)',
        border: '1px solid rgba(37,99,235,0.1)',
      }}
    >
      {/* Browser chrome */}
      <Box sx={{ bgcolor: '#f1f5f9', px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        {['#ef4444', '#f59e0b', '#22c55e'].map((color) => (
          <Box key={color} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
        ))}
        <Box
          sx={{
            flex: 1,
            bgcolor: 'white',
            borderRadius: 1,
            px: 1.5,
            py: 0.3,
            ml: 1,
            fontSize: '0.7rem',
            color: 'text.secondary',
          }}
        >
          app.{branding.logoText.toLowerCase()}.com/dashboard
        </Box>
      </Box>
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          Dashboard Overview
        </Typography>
        <Grid container spacing={1.5}>
          {[
            { label: 'Active Users', value: '2,847', color: '#2563eb' },
            { label: 'Revenue', value: '$12.4K', color: '#7c3aed' },
            { label: 'API Calls', value: '98.2K', color: '#16a34a' },
          ].map((stat) => (
            <Grid size={4} key={stat.label}>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'grey.50',
                  textAlign: 'center',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: stat.color, fontSize: '1rem' }}
                >
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  {stat.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
        <Box
          sx={{
            mt: 2,
            height: 60,
            bgcolor: 'grey.50',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Analytics chart
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function HeroSection() {
  return (
    <Box
      sx={{
        background: GRADIENTS.hero,
        position: 'relative',
        overflow: 'hidden',
        minHeight: '90vh',
        pt: { xs: 10, md: 14 },
        pb: { xs: 8, md: 12 },
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Decorative blobs */}
      <Box
        sx={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          bgcolor: 'rgba(37,99,235,0.12)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '-15%',
          left: '-5%',
          width: 350,
          height: 350,
          borderRadius: '50%',
          bgcolor: 'rgba(124,58,237,0.10)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          {/* Text column */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              <motion.div {...fadeUp(0)}>
                <Chip
                  label="Now in Beta"
                  color="primary"
                  variant="outlined"
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </motion.div>

              <motion.div {...fadeUp(0.1)}>
                <Typography variant="h1" fontWeight={700} sx={{ lineHeight: 1.15 }}>
                  {branding.heroHeadline}{' '}
                  <Box
                    component="span"
                    sx={{
                      background: GRADIENTS.primary,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    {branding.heroHeadlineAccent}
                  </Box>
                </Typography>
              </motion.div>

              <motion.div {...fadeUp(0.2)}>
                <Typography
                  variant="h6"
                  color="text.secondary"
                  sx={{ fontWeight: 400, lineHeight: 1.6 }}
                >
                  {branding.heroSubheadline}
                </Typography>
              </motion.div>

              <motion.div {...fadeUp(0.35)}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <Button
                    component={RouterLink}
                    to={SITE_MAP.register}
                    variant="contained"
                    size="large"
                    sx={{ px: 4, py: 1.5 }}
                  >
                    {branding.ctaText}
                  </Button>
                  <Button
                    component={RouterLink}
                    to={SITE_MAP.pricing}
                    variant="outlined"
                    size="large"
                    sx={{ px: 4, py: 1.5 }}
                  >
                    {branding.ctaSecondaryText}
                  </Button>
                </Stack>
              </motion.div>

              <motion.div {...fadeUp(0.55)}>
                <Typography variant="body2" color="text.secondary">
                  No credit card required · Free forever plan available
                </Typography>
              </motion.div>
            </Stack>
          </Grid>

          {/* Visual mockup column */}
          <Grid size={{ xs: 12, md: 6 }}>
            <FloatingElement amplitude={12} duration={4}>
              <DashboardMockup />
            </FloatingElement>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
