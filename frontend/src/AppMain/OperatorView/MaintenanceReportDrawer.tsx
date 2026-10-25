import type { ReactElement } from 'react';
import {
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  Grid,
  IconButton,
  Typography,
} from '@mui/material';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import PauseCircleIcon from '@mui/icons-material/PauseCircle';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlineOutlined';

import { useUpdateMaintenance, type MaintenanceUpdate } from '../../data/queries';
import type { MaintenancePlan } from '../../data/types';
import AssetCard from './AssetCard';
import MaintenanceCard from './MaintenanceCard';

interface MaintenanceReportDrawerProps {
  open: boolean;
  onClose: () => void;
  maintenance: MaintenancePlan | undefined;
}

interface Action {
  label: string;
  icon: ReactElement;
  color: 'success' | 'info' | 'error';
  changes: () => MaintenanceUpdate;
  show: (status: MaintenancePlan['status'] | undefined) => boolean;
}

// The time of the click, in UTC (the backend stores UTC).
const now = () => new Date().toISOString();

const actions: Action[] = [
  {
    label: 'Start',
    icon: <PlayCircleOutlineIcon fontSize="large" />,
    color: 'success',
    changes: () => ({ status: 'In Progress', started_at: now() }),
    show: (status) => status === 'Pending',
  },
  {
    label: 'Finish',
    icon: <CheckCircleIcon fontSize="large" />,
    color: 'success',
    changes: () => ({ status: 'Completed', finished_at: now() }),
    show: (status) => status === 'In Progress',
  },
  {
    label: 'Pause',
    icon: <PauseCircleIcon fontSize="large" />,
    color: 'info',
    changes: () => ({ status: 'Pending' }),
    show: (status) => status === 'In Progress',
  },
  {
    label: 'Cancel',
    icon: <CancelIcon fontSize="large" />,
    color: 'error',
    changes: () => ({ status: 'Cancelled' }),
    show: () => true,
  },
];

// Operator view of one of their maintenance plans, with start / finish / pause / cancel.
export default function MaintenanceReportDrawer({
  open,
  onClose,
  maintenance,
}: MaintenanceReportDrawerProps) {
  const update = useUpdateMaintenance();

  const run = (action: Action) => {
    if (!maintenance) return;
    update.mutate({ uuid: maintenance.uuid, changes: action.changes() }, { onSuccess: onClose });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100%', md: '900px' } } } }}
    >
      <Backdrop
        sx={{ color: 'common.white', zIndex: (theme) => theme.zIndex.drawer + 10 }}
        open={update.isPending}
      >
        <CircularProgress />
      </Backdrop>

      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <IconButton onClick={onClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
        <Typography variant="h6" sx={{ ml: 2 }}>
          View Maintenance Plan
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ p: 2 }}>
        {actions
          .filter((action) => action.show(maintenance?.status))
          .map((action) => (
            <Grid
              key={action.label}
              size={{ xs: 12, md: 4 }}
              sx={{ display: 'flex', justifyContent: 'center' }}
            >
              <Button
                variant="contained"
                color={action.color}
                startIcon={action.icon}
                onClick={() => run(action)}
                disabled={update.isPending}
                sx={{ height: 100, width: '85%', borderRadius: 2, typography: 'h5', textTransform: 'none' }}
              >
                {action.label}
              </Button>
            </Grid>
          ))}
      </Grid>

      <Divider />

      <Grid container spacing={2} sx={{ p: 2 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <AssetCard asset={maintenance?.asset} />
        </Grid>
        <Grid size={{ xs: 12, md: 8 }}>
          <MaintenanceCard maintenance={maintenance} />
        </Grid>
      </Grid>
    </Drawer>
  );
}
