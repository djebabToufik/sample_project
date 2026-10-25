import { Box, Paper } from '@mui/material';

import type { MachineDataMessage } from '../../../../data/types';
import { useLiveSocket } from '../../../../data/useLiveSocket';
import Event from './Event';

// Strip of the line's latest events, updated live (newest on the right).
export default function LiveEvents({ machine }: { machine: string | undefined }) {
  const message = useLiveSocket<MachineDataMessage>('machine-data', machine);

  return (
    <Paper
      elevation={0}
      sx={{ height: 75, display: 'flex', overflow: 'hidden', justifyContent: 'end' }}
      aria-label="Latest events"
    >
      <Box sx={{ display: 'flex', width: 'fit-content' }}>
        {message?.data?.map((event) => (
          <Event key={event.uuid} event={event} />
        ))}
      </Box>
    </Paper>
  );
}
