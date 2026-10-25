import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Backdrop, Breadcrumbs, CircularProgress, Link, Stack, Typography } from '@mui/material';

interface ListPageProps {
  icon: ReactNode;
  /** Last breadcrumb, e.g. "Assets table" */
  title: string;
  /** Shows a full-page spinner (first load, deleting) */
  loading?: boolean;
  children: ReactNode;
}

// Frame of the app pages: icon + breadcrumbs, a loading overlay, then the content.
export default function ListPage({ icon, title, loading = false, children }: ListPageProps) {
  return (
    <div className="content-wrapper">
      <div className="content-header">
        <Stack spacing={2} direction="row" sx={{ justifyContent: 'space-between', mb: 2, p: 1 }}>
          {icon}
          <Breadcrumbs separator="›" aria-label="breadcrumb">
            <Link component={RouterLink} to="/" underline="hover" color="inherit">
              Home
            </Link>
            <Typography sx={{ color: 'text.primary' }}>{title}</Typography>
          </Breadcrumbs>
        </Stack>
      </div>

      <div className="container-fluid">
        <Backdrop
          sx={{ color: 'common.white', zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={loading}
          data-testid="page-loading"
        >
          <CircularProgress />
        </Backdrop>
        {children}
      </div>
    </div>
  );
}
