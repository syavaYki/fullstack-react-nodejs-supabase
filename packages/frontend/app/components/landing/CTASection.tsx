/**
 * @file CTASection.tsx
 * @description Final call-to-action section.
 */

import { motion } from 'framer-motion';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { RouterLink } from '~/utils/navigation';
import { SITE_MAP } from '~/lib/sitemap';
import { branding } from '@config/branding';
import { GRADIENTS } from '~/theme/index.js';
import FadeInSection from '~/components/animations/FadeInSection.js';

export default function CTASection() {
  return (
    <Box
      sx={{
        py: { xs: 8, md: 12 },
        background: GRADIENTS.cta,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blob */}
      <Box
        sx={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          bgcolor: 'rgba(255,255,255,0.06)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="md" sx={{ textAlign: 'center', position: 'relative' }}>
        <FadeInSection direction="up">
          <Typography variant="h3" fontWeight={700} gutterBottom sx={{ color: 'white' }}>
            {branding.ctaSectionHeadline}
          </Typography>
          <Typography variant="h6" sx={{ mb: 4, opacity: 0.9, color: 'white' }}>
            {branding.ctaSectionSubtext}
          </Typography>
        </FadeInSection>

        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          style={{ display: 'inline-block' }}
        >
          <Button
            component={RouterLink}
            to={SITE_MAP.register}
            variant="contained"
            size="large"
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              px: 4,
              py: 1.5,
              '&:hover': { bgcolor: 'grey.100' },
            }}
          >
            {branding.ctaSectionButtonText}
          </Button>
        </motion.div>
      </Container>
    </Box>
  );
}
