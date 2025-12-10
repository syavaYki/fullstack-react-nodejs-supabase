import type { Route } from './+types/contact';
import { useState, type FormEvent } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid2 as Grid,
  Card,
  CardContent,
  TextField,
  Button,
  Stack,
  Alert,
  CircularProgress,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import * as contactApi from '~/api/contact.api';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Contact Us - SaaS Boilerplate' },
    {
      name: 'description',
      content: 'Get in touch with our team.',
    },
  ];
}

const contactInfo = [
  {
    icon: <EmailIcon sx={{ fontSize: 32 }} />,
    title: 'Email',
    content: 'hello@example.com',
    description: "We'll respond within 24 hours",
  },
  {
    icon: <PhoneIcon sx={{ fontSize: 32 }} />,
    title: 'Phone',
    content: '+1 (555) 123-4567',
    description: 'Mon-Fri 9am-5pm EST',
  },
  {
    icon: <LocationOnIcon sx={{ fontSize: 32 }} />,
    title: 'Office',
    content: '123 Main Street',
    description: 'San Francisco, CA 94102',
  },
];

export default function ContactPage() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const res = await contactApi.submitContactForm({
        first_name: firstName,
        last_name: lastName,
        email,
        subject,
        message,
      });

      if (res.success) {
        setSuccess(res.message || "Thank you for your message. We'll get back to you soon!");
        setFirstName('');
        setLastName('');
        setEmail('');
        setSubject('');
        setMessage('');
      } else {
        const errorMessage =
          res.details?.[0]?.message || res.error || 'Failed to submit form. Please try again.';
        setError(errorMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
      <Box sx={{ textAlign: 'center', mb: 8 }}>
        <Typography variant="h2" gutterBottom>
          Get in Touch
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
          Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as
          possible.
        </Typography>
      </Box>

      <Grid container spacing={6}>
        {/* Contact Form */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" gutterBottom>
                Send us a message
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mt: 2, mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mt: 2, mb: 2 }} onClose={() => setSuccess(null)}>
                  {success}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      fullWidth
                      required
                      disabled={isSubmitting}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      fullWidth
                      required
                      disabled={isSubmitting}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      label="Email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      fullWidth
                      required
                      disabled={isSubmitting}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      label="Subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      fullWidth
                      required
                      disabled={isSubmitting}
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField
                      label="Message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      multiline
                      rows={4}
                      fullWidth
                      required
                      disabled={isSubmitting}
                      helperText="Minimum 10 characters"
                    />
                  </Grid>
                  <Grid size={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={isSubmitting}
                      startIcon={
                        isSubmitting ? <CircularProgress size={20} color="inherit" /> : null
                      }
                    >
                      {isSubmitting ? 'Sending...' : 'Send Message'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Contact Info */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Stack spacing={3}>
            {contactInfo.map((info) => (
              <Card key={info.title}>
                <CardContent sx={{ display: 'flex', gap: 2, p: 3 }}>
                  <Box sx={{ color: 'primary.main' }}>{info.icon}</Box>
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      {info.title}
                    </Typography>
                    <Typography variant="body1">{info.content}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {info.description}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Grid>
      </Grid>
    </Container>
  );
}
