/**
 * @file UpgradeDialog.tsx
 * @description Shared dialog for upgrade prompts when a user hits a usage limit
 * or lacks a feature. Driven by feature keys from constants.
 *
 * Usage: <UpgradeDialog open={open} onClose={close} featureKey="example_limit" />
 */

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router';
import { FEATURE_NAMES, FEATURE_DESCRIPTIONS } from '~/constants';
import { SITE_MAP } from '~/lib/sitemap';

interface UpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  featureKey: string;
}

export default function UpgradeDialog({ open, onClose, featureKey }: UpgradeDialogProps) {
  const navigate = useNavigate();

  const featureName = FEATURE_NAMES[featureKey] || 'This Feature';
  const featureDescription =
    FEATURE_DESCRIPTIONS[featureKey] || 'Upgrade your plan to access this feature.';

  const handleViewPlans = () => {
    onClose();
    navigate(SITE_MAP.membership);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pt: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: 'warning.light',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockIcon sx={{ fontSize: 32, color: 'warning.dark' }} />
          </Box>
        </Box>
        <Typography variant="h6" fontWeight={700}>
          Upgrade to Access {featureName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography align="center" color="text.secondary">
          {featureDescription}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 1 }}>
        <Button onClick={onClose} color="inherit">
          Maybe Later
        </Button>
        <Button onClick={handleViewPlans} variant="contained">
          View Plans
        </Button>
      </DialogActions>
    </Dialog>
  );
}
