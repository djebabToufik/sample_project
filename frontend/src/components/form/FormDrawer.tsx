import type { FormEvent, ReactNode } from 'react';
import {
  AppBar,
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Paper,
  Toolbar,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface FormDrawerProps {
  open: boolean;
  title: string;
  /** "Create" or "Save" */
  submitLabel: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}

// Side panel with a form: title bar with close and submit, scrolling sections below.
export default function FormDrawer({
  open,
  title,
  submitLabel,
  busy = false,
  onClose,
  onSubmit,
  children,
}: FormDrawerProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) onSubmit();
  };

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
      <Box component="form" noValidate onSubmit={submit} aria-label={title} sx={{ display: 'contents' }}>
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
            <Button type="submit" variant="contained" disabled={busy}>
              {submitLabel}
            </Button>
          </Toolbar>
        </AppBar>
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>{children}</Box>
      </Box>
      <Backdrop
        sx={{ color: 'common.white', zIndex: (theme) => theme.zIndex.modal + 1, position: 'absolute' }}
        open={busy}
      >
        <CircularProgress />
      </Backdrop>
    </Drawer>
  );
}

/** Titled group of fields inside a FormDrawer. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper sx={{ p: 3, mb: 3 }} elevation={0}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Divider sx={{ my: 2 }} />
      <Grid container spacing={2}>
        {children}
      </Grid>
    </Paper>
  );
}
