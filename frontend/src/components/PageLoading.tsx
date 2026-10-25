import { Box, CircularProgress } from '@mui/material';

// Shown while the code of a page area loads (first visit only).
export default function PageLoading() {
  return (
    <Box
      sx={{ display: 'flex', justifyContent: 'center', py: 8 }}
      role="progressbar"
      aria-label="Loading page"
    >
      <CircularProgress />
    </Box>
  );
}
