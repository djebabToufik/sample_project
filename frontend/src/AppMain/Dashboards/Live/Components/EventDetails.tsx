import type { ReactNode } from 'react';
import { Divider, ListItemIcon, ListItemText, Menu, MenuItem, MenuList } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BubbleChartIcon from '@mui/icons-material/BubbleChart';
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import QrCodeIcon from '@mui/icons-material/QrCode';
import RepartitionIcon from '@mui/icons-material/Repartition';
import SignalWifiStatusbarNullIcon from '@mui/icons-material/SignalWifiStatusbarNull';
import ThumbDownOffAltIcon from '@mui/icons-material/ThumbDownOffAlt';

import type { MachineEvent } from '../../../../data/types';

interface EventDetailsProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  event: MachineEvent | undefined;
}

// Pop-up menu with the details of one line event.
export default function EventDetails({ open, anchorEl, onClose, event }: EventDetailsProps) {
  const row = (icon: ReactNode, label: string, value: ReactNode) => (
    <MenuItem onClick={onClose}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText>
        {label} <strong>{value}</strong>
      </ListItemText>
    </MenuItem>
  );

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    >
      <MenuList aria-label="Event details">
        <MenuItem onClick={onClose}>
          <ListItemIcon>
            <CloseIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            <strong>Close</strong>
          </ListItemText>
        </MenuItem>
        <Divider />
        {row(
          <AccessTimeIcon fontSize="small" />,
          'Time',
          event?.created_at ? new Date(event.created_at).toLocaleString() : '',
        )}
        {row(<PrecisionManufacturingIcon fontSize="small" />, 'Machine', event?.machine?.name)}
        {row(<SignalWifiStatusbarNullIcon fontSize="small" />, 'Status', event?.state)}
        {row(<BubbleChartIcon fontSize="small" />, 'Quantity', event?.quantity)}
        {row(<ThumbDownOffAltIcon fontSize="small" />, 'Scrap', event?.scrap)}
        {row(<QrCodeIcon fontSize="small" />, 'Product', event?.product?.product_name || 'null')}
        {row(<ErrorOutlineIcon fontSize="small" />, 'Fault', event?.fault?.name || 'null')}
        {row(<RepartitionIcon fontSize="small" />, 'Cell', event?.cell?.name || 'null')}
        <Divider />
      </MenuList>
    </Menu>
  );
}
