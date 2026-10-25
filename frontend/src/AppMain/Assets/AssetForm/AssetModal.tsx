import { CardMedia, Grid } from '@mui/material';

import { brand } from '../../../branding';
import ViewDrawer, { InfoRow, InfoSection, formatDateTime } from '../../../components/form/ViewDrawer';
import type { Asset } from '../../../data/types';

interface AssetModalProps {
  open: boolean;
  asset: Asset | null | undefined;
  onClose: () => void;
}

export default function AssetModal({ open, asset, onClose }: AssetModalProps) {
  if (!asset) return null;
  return (
    <ViewDrawer open={open} title="View Asset" onClose={onClose}>
      <InfoSection title="Basic Information">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <CardMedia
              component="img"
              image={asset.photo ?? brand.assetPlaceholder}
              alt={asset.name}
              sx={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 1 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 8 }}>
            <InfoRow label="Name" value={asset.name} />
            <InfoRow label="Reference" value={asset.ref} />
            <InfoRow label="Type" value={asset.asset_type} />
            <InfoRow label="Serial Number" value={asset.serial_number} />
            <InfoRow label="Status" value={asset.status} />
          </Grid>
        </Grid>
      </InfoSection>
      <InfoSection title="Additional Information">
        <InfoRow label="Location" value={asset.location} />
        <InfoRow label="Purchase Date" value={formatDateTime(asset.purchase_date)} />
        <InfoRow label="Warranty Expires" value={formatDateTime(asset.warranty_expiration_date)} />
        <InfoRow label="Created At" value={formatDateTime(asset.created_at)} />
        <InfoRow label="Last Updated" value={formatDateTime(asset.last_updated_at)} />
        <InfoRow label="Cost" value={asset.cost} />
        <InfoRow label="Current Value" value={asset.current_value} />
      </InfoSection>
    </ViewDrawer>
  );
}
