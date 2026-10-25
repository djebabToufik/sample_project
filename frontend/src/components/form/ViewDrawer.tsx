import type { ReactNode } from 'react';
import { AppBar, Box, Divider, Drawer, IconButton, Paper, Toolbar, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ViewDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Read-only side panel ("View ...") of the admin tables.
export default function ViewDrawer({ open, title, onClose, children }: ViewDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            width: '50vw',
            minWidth: { xs: '100%', sm: 420 },
            maxWidth: 720,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.default',
          },
        },
      }}
    >
      <AppBar
        elevation={0}
        color="default"
        sx={{ position: 'sticky', top: 0, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ flex: 1 }} variant="h6">
            {title}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }} role="region" aria-label={title}>
        {children}
      </Box>
    </Drawer>
  );
}

/** Titled card of a ViewDrawer. */
export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Divider sx={{ my: 2 }} />
      {children}
    </Paper>
  );
}

/** "Label: value" line. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Typography variant="body1" gutterBottom>
      <strong>{label}:</strong> {value}
    </Typography>
  );
}

/** A backend date in the user's local time ('' when there is none). */
export const formatDateTime = (value: string | null | undefined, empty = '') =>
  value ? new Date(value).toLocaleString() : empty;
