import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid2';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FadeInSection from '~/components/animations/FadeInSection.js';

function AuthMockup() {
  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(37,99,235,0.12)',
        border: '1px solid rgba(37,99,235,0.08)',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Sign in
        </Typography>
        <Stack spacing={1.5}>
          <TextField size="small" label="Email" fullWidth disabled value="user@example.com" />
          <TextField
            size="small"
            label="Password"
            type="password"
            fullWidth
            disabled
            value="••••••••"
          />
          <Button variant="contained" fullWidth disabled>
            Sign In
          </Button>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Forgot password? · Create account
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

function BillingMockup() {
  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: '0 8px 32px rgba(124,58,237,0.12)',
        border: '1px solid rgba(124,58,237,0.08)',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Pro Plan
          </Typography>
          <Chip label="Active" color="success" size="small" />
        </Box>
        {[
          { label: 'Plan', value: '$49/mo' },
          { label: 'Next billing', value: 'Apr 7, 2026' },
          { label: 'Usage', value: '2,847 API calls' },
        ].map(({ label, value }) => (
          <Box
            key={label}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              py: 0.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="caption" fontWeight={600}>
              {value}
            </Typography>
          </Box>
        ))}
        <Button variant="outlined" size="small" fullWidth sx={{ mt: 2 }} disabled>
          Manage Subscription
        </Button>
      </CardContent>
    </Card>
  );
}

interface ShowcaseBlockProps {
  chip: string;
  headline: string;
  body: string;
  bullets: string[];
  visual: React.ReactNode;
  reversed?: boolean;
}

function ShowcaseBlock({
  chip,
  headline,
  body,
  bullets,
  visual,
  reversed = false,
}: ShowcaseBlockProps) {
  const textDir = reversed ? 'right' : 'left';
  const visualDir = reversed ? 'left' : 'right';

  const textCol = (
    <Grid size={{ xs: 12, md: 6 }}>
      <FadeInSection direction={textDir}>
        <Stack spacing={2} sx={{ py: { md: 4 } }}>
          <Chip
            label={chip}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ alignSelf: 'flex-start' }}
          />
          <Typography variant="h3" fontWeight={700}>
            {headline}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {body}
          </Typography>
          <Stack spacing={1}>
            {bullets.map((b) => (
              <Box key={b} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="body2">{b}</Typography>
              </Box>
            ))}
          </Stack>
        </Stack>
      </FadeInSection>
    </Grid>
  );

  const visualCol = (
    <Grid size={{ xs: 12, md: 6 }}>
      <FadeInSection direction={visualDir} delay={0.15}>
        {visual}
      </FadeInSection>
    </Grid>
  );

  return (
    <Grid container spacing={6} alignItems="center" sx={{ mb: { xs: 8, md: 12 } }}>
      {reversed ? [visualCol, textCol] : [textCol, visualCol]}
    </Grid>
  );
}

export default function FeaturesShowcase() {
  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'grey.50' }}>
      <Container maxWidth="lg">
        <FadeInSection direction="up">
          <Box sx={{ textAlign: 'center', mb: 10 }}>
            <Chip label="Features" color="primary" variant="outlined" sx={{ mb: 2 }} />
            <Typography variant="h3" fontWeight={700} gutterBottom>
              Everything You Need to Ship
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ maxWidth: 560, mx: 'auto', fontWeight: 400 }}
            >
              Authentication, billing, and infrastructure — all pre-built and production-ready.
            </Typography>
          </Box>
        </FadeInSection>

        <ShowcaseBlock
          chip="Authentication"
          headline="Secure Auth, Out of the Box"
          body="Full authentication flow powered by Supabase — email/password, password reset, session management, and role-based access."
          bullets={[
            'Email & password authentication',
            'Secure session management with cookies',
            'Password reset via email',
            'Admin role support built in',
          ]}
          visual={<AuthMockup />}
          reversed={false}
        />

        <ShowcaseBlock
          chip="Billing"
          headline="Stripe Billing, Fully Integrated"
          body="Subscription management, usage tracking, and webhook handling — wired to your database and ready for real customers."
          bullets={[
            'Monthly & yearly billing cycles',
            'Usage-based feature limits',
            'Stripe webhook processing',
            'Customer portal for self-service',
          ]}
          visual={<BillingMockup />}
          reversed={true}
        />
      </Container>
    </Box>
  );
}
