import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import BugReportIcon from '@mui/icons-material/BugReport';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { submitBugReport } from '~/api/bug-report.api.js';
import ImageDropzone from './ImageDropzone.js';

interface BugReportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FormErrors {
  description?: string;
  email?: string;
}

export default function BugReportDialog({ open, onClose }: BugReportDialogProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  // Auto-capture current page URL (Option A — silent, not shown to user)
  const [pageUrl] = useState(() => (typeof window !== 'undefined' ? window.location.href : ''));

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setEmail('');
      setDescription('');
      setImages([]);
      setErrors({});
      setServerError('');
      setSuccess(false);
    }
  }, [open]);

  // Auto-close 2 seconds after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, onClose]);

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (description.trim().length < 10) {
      next.description = 'Description must be at least 10 characters';
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'Please enter a valid email address';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    const res = await submitBugReport(
      {
        name: name || undefined,
        email: email || undefined,
        description,
        page_url: pageUrl || undefined,
      },
      images
    );
    setSubmitting(false);

    if (res.success) {
      setSuccess(true);
    } else {
      setServerError(res.error || 'Failed to submit bug report. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <BugReportIcon color="error" />
        Report a Bug
      </DialogTitle>

      {success ? (
        <DialogContent>
          <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 56 }} />
            <Typography variant="h6" align="center">
              Bug report submitted!
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Thank you — we'll investigate and address the issue.
            </Typography>
          </Stack>
        </DialogContent>
      ) : (
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent>
            <Stack spacing={2.5}>
              {serverError && <Alert severity="error">{serverError}</Alert>}

              <Typography variant="body2" color="text.secondary">
                Describe what happened and optionally attach screenshots. Name and email are
                optional but help us follow up.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  size="small"
                  disabled={submitting}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  size="small"
                  disabled={submitting}
                  error={!!errors.email}
                  helperText={errors.email}
                />
              </Stack>

              <TextField
                label="Describe the bug *"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={4}
                fullWidth
                required
                disabled={submitting}
                error={!!errors.description}
                helperText={errors.description || `${description.length}/5000`}
                inputProps={{ maxLength: 5000 }}
              />

              <ImageDropzone images={images} onChange={setImages} />
            </Stack>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="error"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {submitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogActions>
        </Box>
      )}
    </Dialog>
  );
}
