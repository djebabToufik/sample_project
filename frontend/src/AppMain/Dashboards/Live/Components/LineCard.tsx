import { useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import { Card, CardActions, CardContent, CardHeader, IconButton, Tooltip } from '@mui/material';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GppBadIcon from '@mui/icons-material/GppBad';
import { LineChart } from '@mui/x-charts/LineChart';

import { palette } from '../../../../branding';
import { rememberLine } from '../../../../data/rememberedLine';
import type { Asset, MachineOeeMessage } from '../../../../data/types';
import { useLiveSocket } from '../../../../data/useLiveSocket';
import EventDetails from './EventDetails';

// Live card of one line: OEE per hour over the last 24 h, the latest event,
// and links to the line's OEE dashboards.
export default function LineCard({ machine }: { machine: Asset }) {
  const message = useLiveSocket<MachineOeeMessage>('machine-oee', machine.uuid);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const oeePerHour = (message?.oee ?? []).map((hour) => hour.oee);
  // The backend sends the latest event first (only one).
  const latestEvent = message?.list?.[0];

  const dashboardLink = (label: string, to: string, icon: ReactNode) => (
    <Tooltip title={label}>
      <IconButton
        component={RouterLink}
        to={to}
        aria-label={label}
        color="primary"
        // The dashboard opens on the remembered line.
        onClick={() => rememberLine(machine.uuid)}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );

  return (
    <Card elevation={1} sx={{ mb: 3, height: '100%' }} aria-label={`Line ${machine.name}`}>
      <CardHeader sx={{ pb: 0 }} subheader={machine.name || '-'} />
      <CardContent sx={{ p: 0 }}>
        <LineChart
          xAxis={[{ data: oeePerHour.map((_, hour) => hour), label: 'OEE last 24h', max: 24 }]}
          yAxis={[
            {
              colorMap: {
                type: 'piecewise',
                thresholds: [65],
                colors: [palette.warning.main, palette.success.main],
              },
            },
          ]}
          series={[{ data: oeePerHour, area: true, showMark: false }]}
          height={200}
        />
      </CardContent>
      <CardActions disableSpacing>
        <Tooltip title="Last event">
          <IconButton aria-label="Last event" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <EventNoteIcon />
          </IconButton>
        </Tooltip>
        {dashboardLink('OEE', '/dashboards/oee', <AutoModeIcon />)}
        {dashboardLink('Downtimes', '/dashboards/downtimes', <GppBadIcon />)}
        {dashboardLink('Energy & costs', '/dashboards/energy', <ElectricBoltIcon />)}
        <EventDetails
          open={anchorEl !== null}
          anchorEl={anchorEl}
          onClose={() => setAnchorEl(null)}
          event={latestEvent}
        />
      </CardActions>
    </Card>
  );
}
