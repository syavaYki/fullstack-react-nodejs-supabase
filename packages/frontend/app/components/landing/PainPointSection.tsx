import { motion } from 'framer-motion';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid2';
import Chip from '@mui/material/Chip';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SecurityIcon from '@mui/icons-material/Security';
import BuildIcon from '@mui/icons-material/Build';
import FadeInSection from '~/components/animations/FadeInSection.js';

const painPoints = [
  {
    icon: <AccessTimeIcon sx={{ fontSize: 32 }} />,
    color: '#dc2626',
    bgcolor: '#fef2f2',
    title: 'Weeks of Boilerplate',
    description:
      'Setting up auth, billing, databases, and APIs from scratch consumes weeks of engineering time before you can ship a single feature.',
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 32 }} />,
    color: '#d97706',
    bgcolor: '#fffbeb',
    title: 'Security Risks',
    description:
      'Rolling your own authentication and payment flows introduces vulnerabilities. One mistake can expose user data or lose revenue.',
  },
  {
    icon: <BuildIcon sx={{ fontSize: 32 }} />,
    color: '#7c3aed',
    bgcolor: '#f5f3ff',
    title: 'Maintenance Overhead',
    description:
      'Keeping dependencies updated, handling breaking changes, and debugging infrastructure pulls focus away from your core product.',
  },
];

export default function PainPointSection() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <FadeInSection direction="up">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Chip label="The Problem" variant="outlined" color="error" sx={{ mb: 2 }} />
            <Typography variant="h3" fontWeight={700} gutterBottom>
              Building SaaS is Hard
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 560, mx: 'auto', fontWeight: 400 }}
            >
              Most founders spend months on infrastructure instead of the product that actually
              differentiates them.
            </Typography>
          </Box>
        </FadeInSection>

        <Grid container spacing={3}>
          {painPoints.map((point, index) => (
            <Grid size={{ xs: 12, md: 4 }} key={point.title}>
              <FadeInSection direction="up" delay={index * 0.1}>
                <motion.div whileHover={{ scale: 1.03, y: -4 }} transition={{ duration: 0.2 }}>
                  <Card variant="outlined" sx={{ height: '100%', p: 1 }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: point.bgcolor,
                          color: point.color,
                          mb: 2,
                        }}
                      >
                        {point.icon}
                      </Box>
                      <Typography variant="h5" fontWeight={700} gutterBottom>
                        {point.title}
                      </Typography>
                      <Typography variant="body1" color="text.secondary">
                        {point.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </motion.div>
              </FadeInSection>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
