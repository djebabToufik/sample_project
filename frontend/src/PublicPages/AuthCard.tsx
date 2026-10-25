import type { FormEvent, ReactNode } from 'react';
import {
  Backdrop,
  Box,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Grid,
  Typography,
} from '@mui/material';

import { brand } from '../branding';

interface AuthCardProps {
  title: string;
  loading?: boolean;
  /** Called on submit (button or Enter key) */
  onSubmit: () => void;
  children: ReactNode;
}

// Card on the branded background, shared by the login and account pages.
// The content is a form, so Enter submits it.
export default function AuthCard({ title, loading = false, onSubmit, children }: AuthCardProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!loading) onSubmit();
  };

  return (
    <Grid
      container
      sx={(theme) => ({
        minHeight: '100vh',
        background: theme.authBackground,
        justifyContent: 'center',
        alignItems: 'center',
        p: 2,
      })}
    >
      <Backdrop sx={{ color: 'common.white', zIndex: (theme) => theme.zIndex.modal + 1 }} open={loading}>
        <CircularProgress />
      </Backdrop>
      <Card elevation={6} sx={{ width: { xs: '100%', sm: 450 }, borderRadius: 3 }}>
        <CardMedia
          component="img"
          image={brand.logo}
          alt={brand.appName}
          sx={{ width: 90, height: 90, objectFit: 'contain', mx: 'auto', mt: 4 }}
        />
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" align="center" sx={{ mb: 3 }}>
            {title}
          </Typography>
          <Box component="form" noValidate onSubmit={submit} aria-label={title}>
            {children}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );
}
