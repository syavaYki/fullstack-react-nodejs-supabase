import { Link } from 'react-router';
import {
  Box,
  Container,
  Grid2 as Grid,
  Typography,
  Stack,
  IconButton,
  Divider,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import GitHubIcon from '@mui/icons-material/GitHub';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';

const footerLinks = {
  Product: [
    { label: 'Features', path: '/features/free' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Documentation', path: '#' },
    { label: 'API Reference', path: '#' },
  ],
  Company: [
    { label: 'About', path: '#' },
    { label: 'Blog', path: '#' },
    { label: 'Careers', path: '#' },
    { label: 'Contact', path: '/contact' },
  ],
  Legal: [
    { label: 'Privacy Policy', path: '#' },
    { label: 'Terms of Service', path: '#' },
    { label: 'Cookie Policy', path: '#' },
  ],
};

export function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: 'grey.900',
        color: 'grey.300',
        pt: 8,
        pb: 4,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          {/* Brand Column */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <RocketLaunchIcon sx={{ color: 'primary.light' }} />
              <Typography variant="h6" sx={{ color: 'white', fontWeight: 700 }}>
                SaaS Boilerplate
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ mb: 3, maxWidth: 300 }}>
              A production-ready full-stack template for building modern SaaS applications.
            </Typography>
            <Stack direction="row" spacing={1}>
              <IconButton
                href="https://github.com"
                target="_blank"
                rel="noopener"
                sx={{ color: 'grey.400', '&:hover': { color: 'white' } }}
              >
                <GitHubIcon />
              </IconButton>
              <IconButton
                href="https://twitter.com"
                target="_blank"
                rel="noopener"
                sx={{ color: 'grey.400', '&:hover': { color: 'white' } }}
              >
                <TwitterIcon />
              </IconButton>
              <IconButton
                href="https://linkedin.com"
                target="_blank"
                rel="noopener"
                sx={{ color: 'grey.400', '&:hover': { color: 'white' } }}
              >
                <LinkedInIcon />
              </IconButton>
            </Stack>
          </Grid>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <Grid size={{ xs: 6, sm: 4, md: 2 }} key={category}>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600, mb: 2 }}>
                {category}
              </Typography>
              <Stack spacing={1}>
                {links.map((link) => (
                  <Typography
                    key={link.label}
                    component={Link}
                    to={link.path}
                    variant="body2"
                    sx={{
                      color: 'grey.400',
                      textDecoration: 'none',
                      '&:hover': { color: 'white' },
                    }}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Stack>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 4, borderColor: 'grey.800' }} />

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="body2" sx={{ color: 'grey.500' }}>
            &copy; {new Date().getFullYear()} SaaS Boilerplate. All rights reserved.
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.500' }}>
            Built with React, TypeScript, and MUI
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
