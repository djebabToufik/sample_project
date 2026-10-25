import { Box, Chip, Divider, Paper, Stack, Typography, type ChipProps } from '@mui/material';

import type { Asset } from '../../data/types';

const statusColor: Record<string, ChipProps['color']> = {
  Active: 'success',
  'Under Maintenance': 'warning',
  Inactive: 'error',
  Retired: 'info',
};

// Details of an asset (operator drawer, Agenda viewer).
export default function AssetCard({ asset }: { asset: Asset | null | undefined }) {
  const warranty = asset?.warranty_expiration_date ? new Date(asset.warranty_expiration_date) : null;
  // Red once the warranty ended, green before, neutral when no date is set.
  const warrantyColor = warranty
    ? Date.now() > warranty.getTime()
      ? 'error.main'
      : 'success.main'
    : undefined;

  return (
    <Paper elevation={1} sx={{ p: 3, mb: 3 }} aria-label="Asset">
      {asset?.photo && (
        <Box sx={{ height: 200, borderRadius: 2, overflow: 'hidden', mb: 2, bgcolor: 'action.hover' }}>
          <img
            src={asset.photo}
            alt={asset.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </Box>
      )}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        {asset?.name}
      </Typography>
      <Divider sx={{ mb: 3 }} />
      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>Reference:</strong> {asset?.ref}
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>Type:</strong> {asset?.asset_type}
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>Serial:</strong> {asset?.serial_number}
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          <strong>Location:</strong> {asset?.location}
        </Typography>
        <Typography variant="body1" sx={{ color: warrantyColor }}>
          <strong>Warranty:</strong> {warranty ? warranty.toDateString() : '-'}
        </Typography>
      </Box>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" spacing={1}>
        <Chip label={asset?.status} color={statusColor[asset?.status ?? '']} />
      </Stack>
    </Paper>
  );
}
