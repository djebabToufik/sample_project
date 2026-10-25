import { AppBar, Box, Divider, Drawer, IconButton, Toolbar, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import type { MaintenancePlan } from '../../../data/types';
import AssetCard from '../../OperatorView/AssetCard';
import MaintenanceCard from '../../OperatorView/MaintenanceCard';

interface MaintenanceViewerDrawerProps {
  open: boolean;
  onClose: () => void;
  maintenance: MaintenancePlan | null | undefined;
}

export default function MaintenanceViewerDrawer({
  open,
  onClose,
  maintenance,
}: MaintenanceViewerDrawerProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: '50vw', minWidth: 420, maxWidth: 720 } } }}
    >
      <AppBar position="sticky" color="default" elevation={0}>
        <Toolbar>
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ flex: 1 }} variant="h6">
            Maintenance Details
          </Typography>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 3, overflowY: 'auto', height: '100%' }}>
        <MaintenanceCard maintenance={maintenance} />
        <Divider sx={{ my: 3 }} />
        <AssetCard asset={maintenance?.asset} />
      </Box>
    </Drawer>
  );
}
