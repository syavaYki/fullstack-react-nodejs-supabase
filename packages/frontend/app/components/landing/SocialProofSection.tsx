import { motion } from 'framer-motion';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Avatar from '@mui/material/Avatar';
import { GRADIENTS } from '~/theme/index.js';
import FadeInSection from '~/components/animations/FadeInSection.js';
import CountUp from '~/components/animations/CountUp.js';

const stats = [
  { label: 'Developers', end: 10000, suffix: '+' },
  { label: 'Uptime', end: 99, suffix: '.9%' },
  { label: 'API Calls / mo', end: 500000, suffix: '+' },
  { label: 'Setup Time', end: 48, prefix: '<', suffix: 'h' },
];

const testimonials = [
  {
    quote:
      'Shipped our MVP in 2 days instead of 2 months. The auth and billing were just there — we focused entirely on our product.',
    name: 'Sarah K.',
    role: 'Founder, DataFlow',
    initials: 'SK',
    color: '#2563eb',
  },
  {
    quote:
      'The Stripe integration saved us from weeks of webhook debugging. Production-ready from day one.',
    name: 'Marcus T.',
    role: 'CTO, BuildFast',
    initials: 'MT',
    color: '#7c3aed',
  },
  {
    quote:
      'Exactly what I needed as a solo developer. Full-stack TypeScript, Supabase, and MUI — just works.',
    name: 'Priya L.',
    role: 'Indie Hacker',
    initials: 'PL',
    color: '#16a34a',
  },
];

export default function SocialProofSection() {
  return (
    <>
      {/* Stats bar */}
      <Box sx={{ background: GRADIENTS.primary, py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} justifyContent="center">
            {stats.map((stat, index) => (
              <Grid size={{ xs: 6, md: 3 }} key={stat.label}>
                <FadeInSection direction="up" delay={index * 0.1}>
                  <Box sx={{ textAlign: 'center', color: 'white' }}>
                    <Typography variant="h3" fontWeight={800} sx={{ lineHeight: 1 }}>
                      <CountUp end={stat.end} suffix={stat.suffix} prefix={stat.prefix} />
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.5 }}>
                      {stat.label}
                    </Typography>
                  </Box>
                </FadeInSection>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Testimonials */}
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'grey.50' }}>
        <Container maxWidth="lg">
          <FadeInSection direction="up">
            <Typography variant="h3" fontWeight={700} align="center" gutterBottom>
              Loved by Developers
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              align="center"
              sx={{ mb: 8, fontWeight: 400 }}
            >
              Join thousands of teams shipping faster.
            </Typography>
          </FadeInSection>

          <Grid container spacing={3}>
            {testimonials.map((t, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={t.name}>
                <FadeInSection direction="up" delay={index * 0.1}>
                  <motion.div whileHover={{ y: -6 }} transition={{ duration: 0.2 }}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography
                          variant="body1"
                          color="text.secondary"
                          sx={{ mb: 3, lineHeight: 1.7 }}
                        >
                          "{t.quote}"
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            sx={{ bgcolor: t.color, width: 40, height: 40, fontSize: '0.85rem' }}
                          >
                            {t.initials}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={700}>
                              {t.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {t.role}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </motion.div>
                </FadeInSection>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    </>
  );
}
