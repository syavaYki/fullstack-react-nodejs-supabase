/**
 * @file NewsletterSection.tsx
 * @description Newsletter signup section wired to the backend API.
 */

import { useState } from 'react';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import { subscribeToNewsletter } from '~/api/newsletter.api';
import { GRADIENTS } from '~/theme/index.js';
import FadeInSection from '~/components/animations/FadeInSection.js';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const res = await subscribeToNewsletter(email);

    if (res.success) {
      setSuccess(true);
      setEmail('');
    } else {
      setError(res.error || 'Failed to subscribe. Please try again.');
    }
    setSubmitting(false);
  };

  return (
    <Box sx={{ py: { xs: 6, md: 8 }, background: GRADIENTS.heroStrong }}>
      <Container maxWidth="sm" sx={{ textAlign: 'center' }}>
        <FadeInSection direction="up">
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Stay Updated
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Get the latest news and updates delivered to your inbox.
          </Typography>

          {success ? (
            <Alert severity="success">You're subscribed! Check your inbox for confirmation.</Alert>
          ) : (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Box
                component="form"
                onSubmit={handleSubmit}
                sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}
              >
                <TextField
                  placeholder="Enter your email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  size="small"
                  sx={{ flex: 1, maxWidth: 300 }}
                />
                <Button type="submit" variant="contained" disabled={submitting}>
                  {submitting ? 'Subscribing...' : 'Subscribe'}
                </Button>
              </Box>
            </>
          )}
        </FadeInSection>
      </Container>
    </Box>
  );
}
