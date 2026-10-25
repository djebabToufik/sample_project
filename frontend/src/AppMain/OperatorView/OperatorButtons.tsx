import { useState } from 'react';
import { Button, Grid } from '@mui/material';

import { useSendLineEvent } from '../../data/queries';
import type { Cell, Fault, MachineEvent, Product } from '../../data/types';
import { useLiveSocket } from '../../data/useLiveSocket';
import { actionsFor, faultStates, stateColor } from './lineActions';
import ReportDialog from './ReportDialog';

interface OperatorButtonsProps {
  machine: string | undefined;
  /** All cells / faults; only the chosen line's are offered */
  cells: Cell[];
  faults: Fault[];
  products: Product[];
}

// Current state of the line (live) and the actions an operator can take from it.
export default function OperatorButtons({ machine, cells, faults, products }: OperatorButtonsProps) {
  const message = useLiveSocket<{ data: MachineEvent }>('machine-report', machine);
  const lastEvent = message?.data;
  const state = lastEvent?.state;
  const send = useSendLineEvent();
  const [reportOpen, setReportOpen] = useState(false);

  if (!machine) return null;

  const mustReport = state !== undefined && faultStates.includes(state);

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={12}>
          <Button
            sx={{ width: '100%', height: 50 }}
            variant="contained"
            color={(state && stateColor[state]) || 'inherit'}
            aria-label="Machine state"
            disableRipple
          >
            {state ? `Machine state: ${state}` : 'Waiting for the line state…'}
          </Button>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {actionsFor(state).map((action) => (
          <Grid key={action.label} size={{ xs: 12, lg: 4 }}>
            <Button
              sx={{ width: '100%', height: 150 }}
              variant="contained"
              color={action.color}
              disabled={send.isPending}
              onClick={() =>
                action.send === 'report' ? setReportOpen(true) : send.mutate({ machine, state: action.send })
              }
            >
              {action.label}
            </Button>
          </Grid>
        ))}
      </Grid>

      <ReportDialog
        open={mustReport || reportOpen}
        state={state}
        machine={lastEvent?.machine?.uuid ?? machine}
        cells={cells.filter((c) => c.machine?.uuid === machine)}
        faults={faults.filter((f) => f.machine?.uuid === machine)}
        products={products}
        busy={send.isPending}
        onReport={(event) => send.mutate(event, { onSettled: () => setReportOpen(false) })}
        onCancel={() => setReportOpen(false)}
      />
    </>
  );
}
