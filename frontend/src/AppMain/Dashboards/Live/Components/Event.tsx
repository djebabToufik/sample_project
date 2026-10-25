import { useState, type ReactElement } from 'react';
import { Card, CardHeader, IconButton } from '@mui/material';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import FreeBreakfastIcon from '@mui/icons-material/FreeBreakfast';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlineOutlined';
import PowerIcon from '@mui/icons-material/Power';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import ReportIcon from '@mui/icons-material/Report';
import ReportOffIcon from '@mui/icons-material/ReportOff';
import StopCircleIcon from '@mui/icons-material/StopCircle';

import type { MachineEvent } from '../../../../data/types';
import EventDetails from './EventDetails';

// Background (theme color path) and icon per line state.
const red = 'error.light';
const orange = 'warning.light';
const purple = 'secondary.light';
const green = 'success.light';
const blue = 'primary.light';

const stateStyle: Record<string, { color: string; icon: ReactElement }> = {
  on: { color: blue, icon: <PowerIcon /> },
  off: { color: 'grey.500', icon: <PowerOffIcon /> },
  fault: { color: orange, icon: <ReportIcon /> },
  'resume fault': { color: green, icon: <ReportOffIcon /> },
  failure: { color: orange, icon: <ReportIcon /> },
  'resume failure': { color: blue, icon: <ReportOffIcon /> },
  'out of order': { color: red, icon: <ReportIcon /> },
  'resume out of order': { color: blue, icon: <ReportOffIcon /> },
  'break in': { color: purple, icon: <FreeBreakfastIcon /> },
  'resume break in': { color: green, icon: <PlayCircleOutlineIcon /> },
  'break out': { color: purple, icon: <FreeBreakfastIcon /> },
  'resume break out': { color: blue, icon: <PowerIcon /> },
  report: { color: green, icon: <AssignmentTurnedInOutlinedIcon /> },
  run: { color: green, icon: <PlayCircleOutlineIcon /> },
  stop: { color: blue, icon: <StopCircleIcon /> },
};

// One tile of the event strip; the menu button shows the event's details.
export default function Event({ event }: { event: MachineEvent }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const style = stateStyle[event.state];

  return (
    <Card
      sx={{ width: '100px', height: '80%', m: 'auto', mx: 1, bgcolor: style?.color }}
      elevation={1}
      aria-label={`Event ${event.state}`}
    >
      <CardHeader
        avatar={style?.icon}
        action={
          <IconButton aria-label="Event details" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreVertIcon />
          </IconButton>
        }
      />
      <EventDetails
        open={anchorEl !== null}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        event={event}
      />
    </Card>
  );
}
