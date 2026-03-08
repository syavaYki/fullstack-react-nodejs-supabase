import { useState } from 'react';
import Fab from '@mui/material/Fab';
import Tooltip from '@mui/material/Tooltip';
import BugReportIcon from '@mui/icons-material/BugReport';
import BugReportDialog from './BugReportDialog.js';

export default function BugReportFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Tooltip title="Report a Bug" placement="left">
        <Fab
          color="default"
          size="medium"
          onClick={() => setOpen(true)}
          aria-label="Report a bug"
          sx={{
            position: 'fixed',
            bottom: { xs: 72, md: 24 },
            right: 24,
            zIndex: 1200,
            bgcolor: 'background.paper',
            color: 'error.main',
            boxShadow: 3,
            '&:hover': { bgcolor: 'error.main', color: 'white' },
          }}
        >
          <BugReportIcon />
        </Fab>
      </Tooltip>

      <BugReportDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
