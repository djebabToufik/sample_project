import type { ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import BarChartIcon from '@mui/icons-material/BarChart';
import CategoryIcon from '@mui/icons-material/Category';
import ConstructionIcon from '@mui/icons-material/Construction';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import DateRangeIcon from '@mui/icons-material/DateRange';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FmdBadIcon from '@mui/icons-material/FmdBad';
import GppBadIcon from '@mui/icons-material/GppBad';
import PersonIcon from '@mui/icons-material/Person';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import SensorsIcon from '@mui/icons-material/Sensors';
import TuneIcon from '@mui/icons-material/Tune';

import { useAuth } from '../../auth/AuthContext';
import { brand } from '../../branding';
import { FEATURE_CMMS, FEATURE_OEE } from '../../Config';

interface Link {
  text: string;
  to: string;
  icon: ReactNode;
  /** Highlighted while the URL starts with this (default: `to`) */
  match?: string;
}

interface Section {
  title: string;
  links: Link[];
  show: boolean;
}

function sections(isAdmin: boolean): Section[] {
  return [
    {
      title: 'Production',
      show: isAdmin && FEATURE_OEE,
      links: [
        { text: 'Live', to: '/dashboards/live', icon: <SensorsIcon /> },
        { text: 'OEE', to: '/dashboards/oee', icon: <AutoModeIcon /> },
        { text: 'Downtimes', to: '/dashboards/downtimes', icon: <GppBadIcon /> },
        { text: 'Energy & costs', to: '/dashboards/energy', icon: <ElectricBoltIcon /> },
      ],
    },
    {
      title: 'Maintenance',
      show: isAdmin && FEATURE_CMMS,
      links: [
        { text: 'Assets', to: '/cmms/dashboards/assets', icon: <AutoGraphIcon /> },
        { text: 'Maintenances', to: '/cmms/dashboards/maintenances', icon: <BarChartIcon /> },
        { text: 'Agenda', to: '/cmms/dashboards/agenda', icon: <DateRangeIcon /> },
        {
          text: 'Maintenance plans',
          to: '/cmms/maintenance/add',
          match: '/cmms/maintenance',
          icon: <ConstructionIcon />,
        },
      ],
    },
    {
      title: 'Administration',
      show: isAdmin,
      links: [
        {
          text: 'Lines',
          to: '/admin/assets/table',
          match: '/admin/assets',
          icon: <PrecisionManufacturingIcon />,
        },
        { text: 'Cells', to: '/admin/cells/table', match: '/admin/cells', icon: <DashboardCustomizeIcon /> },
        { text: 'Faults', to: '/admin/faults/table', match: '/admin/faults', icon: <FmdBadIcon /> },
        { text: 'Products', to: '/admin/products/table', match: '/admin/products', icon: <CategoryIcon /> },
        { text: 'Users', to: '/admin/users/add', match: '/admin/users', icon: <PersonIcon /> },
      ],
    },
    {
      title: 'Operator',
      show: true,
      links: [
        { text: 'My Schedule', to: '/operator/agenda', icon: <EventNoteIcon /> },
        { text: 'Control', to: '/operator/control', icon: <TuneIcon /> },
      ],
    },
  ];
}

interface ItemProps {
  open: boolean;
  text: string;
  to: string;
  icon: ReactNode;
  selected?: boolean;
}

/** Menu entry; collapsed, only the icon shows, with the text as tooltip. */
function Item({ open, text, to, icon, selected = false }: ItemProps) {
  return (
    <Tooltip title={open ? '' : text} placement="right">
      <ListItemButton component={RouterLink} to={to} selected={selected}>
        <ListItemIcon sx={{ minWidth: 40 }}>{icon}</ListItemIcon>
        {open && <ListItemText primary={text} />}
      </ListItemButton>
    </Tooltip>
  );
}

export default function SidebarMiniDrawer({ open }: { open: boolean }) {
  const { isAdmin } = useAuth();
  const { sidebarWidth, sidebarMiniWidth } = useTheme().layout;
  const { pathname } = useLocation();

  const subheader = (title: string) =>
    open && <ListSubheader sx={{ pl: 2, fontWeight: 'bold', lineHeight: 2.5 }}>{title}</ListSubheader>;

  return (
    <Drawer
      variant="permanent"
      slotProps={{
        paper: {
          sx: {
            width: open ? sidebarWidth : sidebarMiniWidth,
            transition: 'width 0.2s ease',
            whiteSpace: 'nowrap',
            overflowX: 'hidden',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        },
      }}
    >
      <Box component="nav" aria-label="Main menu">
        <List>
          <Item
            open={open}
            text={brand.appName}
            to="/"
            icon={
              <img
                src={brand.logo}
                alt=""
                style={{ maxWidth: 30, maxHeight: 30, width: 'auto', height: 'auto' }}
              />
            }
          />
        </List>
        {sections(isAdmin)
          .filter((section) => section.show)
          .map((section) => (
            <Box key={section.title}>
              <Divider sx={{ my: 1 }} />
              <List subheader={subheader(section.title) || undefined}>
                {section.links.map((link) => (
                  <Item
                    key={link.to}
                    open={open}
                    text={link.text}
                    to={link.to}
                    icon={link.icon}
                    selected={pathname.startsWith(link.match ?? link.to)}
                  />
                ))}
              </List>
            </Box>
          ))}
      </Box>
    </Drawer>
  );
}
