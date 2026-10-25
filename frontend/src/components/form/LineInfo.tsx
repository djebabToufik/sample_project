import type { ReactNode } from 'react';
import { CardMedia, Grid } from '@mui/material';

import { brand } from '../../branding';
import type { Asset } from '../../data/types';
import { InfoRow } from './ViewDrawer';

// Photo of the line next to the item's details (cell and fault view panels).
export default function LineInfo({
  machine,
  children,
}: {
  machine: Asset | null | undefined;
  children: ReactNode;
}) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 4 }}>
        <CardMedia
          component="img"
          image={machine?.photo ?? brand.assetPlaceholder}
          alt={machine?.name}
          sx={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 1 }}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 8 }}>
        {children}
        <InfoRow label="Machine Name" value={machine?.name} />
        <InfoRow label="Machine Type" value={machine?.asset_type || 'N/A'} />
        <InfoRow label="Status" value={machine?.status || 'Unknown'} />
      </Grid>
    </Grid>
  );
}
