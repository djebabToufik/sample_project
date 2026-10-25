import { useEffect, useState, type ReactNode } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Tooltip,
} from '@mui/material';
import CachedIcon from '@mui/icons-material/Cached';
import FilterListIcon from '@mui/icons-material/FilterList';
import FilterListOffIcon from '@mui/icons-material/FilterListOff';
import PrintIcon from '@mui/icons-material/Print';
import { toast } from 'react-toastify';

import { toLocalInputValue } from '../../../data/dates';
import type { DateRange } from '../../../data/queries';
import { presets, toBackendDate, type LineFilterState } from './useLineFilter';

const NO_LINES = 'You have no line created, go to the Sidebar -> Lines to start!';

// Line picker, quick periods and a custom date range for the OEE dashboards.
export default function LineFilter({ filter }: { filter: LineFilterState }) {
  const { lines, line, selectLine, preset, choosePreset, range, applyRange, refresh, downtime, noLines } =
    filter;
  const [showDates, setShowDates] = useState(false);
  // Dates typed in the From / To fields, applied with "Filter".
  const [draft, setDraft] = useState<Partial<DateRange>>({});
  const from = draft.from ?? range.from;
  const to = draft.to ?? range.to;

  useEffect(() => {
    if (noLines) toast.info(NO_LINES, { autoClose: false, toastId: NO_LINES });
  }, [noLines]);

  const action = (label: string, onClick: () => void, icon: ReactNode) => (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={onClick} color="primary">
        {icon}
      </IconButton>
    </Tooltip>
  );

  // The fields show the window in local time; the range keeps it as ISO dates (see useLineFilter).
  const dateField = (name: keyof DateRange, label: string, value: string) => (
    <FormControl variant="standard" fullWidth sx={{ m: 0 }}>
      <TextField
        label={label}
        type="datetime-local"
        value={toLocalInputValue(new Date(value), true)}
        onChange={(e) =>
          // A cleared field keeps the current date.
          setDraft({ ...draft, [name]: e.target.value ? toBackendDate(new Date(e.target.value)) : undefined })
        }
        autoComplete="off"
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 1 } }}
      />
    </FormControl>
  );

  return (
    <Card elevation={0}>
      <CardHeader
        subheader="Select your line and date range"
        action={
          <>
            {action(
              'Refresh',
              refresh,
              downtime.isFetching ? <CircularProgress size={24} /> : <CachedIcon />,
            )}
            {action('Print', () => window.print(), <PrintIcon />)}
            {showDates
              ? action('Hide date filter', () => setShowDates(false), <FilterListOffIcon />)
              : action('Show date filter', () => setShowDates(true), <FilterListIcon />)}
          </>
        }
      />
      <CardContent>
        {showDates && (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 3, md: 4 }}>{dateField('from', 'From', from)}</Grid>
            <Grid size={{ xs: 3, md: 4 }}>{dateField('to', 'To', to)}</Grid>
            <Grid
              size={{ xs: 3, md: 4 }}
              sx={{ display: 'flex', height: 50, justifyContent: 'end', alignItems: 'center' }}
            >
              <Button
                variant="contained"
                onClick={() => {
                  applyRange({ from, to });
                  setDraft({});
                }}
              >
                Filter
              </Button>
            </Grid>
          </Grid>
        )}
        <Grid container spacing={2}>
          <Grid size={{ xs: 3, md: 6 }}>
            <FormControl variant="standard" fullWidth sx={{ m: 1 }}>
              <Select
                value={line ?? ''}
                onChange={(e) => selectLine(e.target.value)}
                inputProps={{ 'aria-label': 'Line' }}
              >
                {lines.map((asset) => (
                  <MenuItem key={asset.uuid} value={asset.uuid}>
                    {asset.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
        <Grid container spacing={2}>
          <Grid size={12} sx={{ display: 'flex', flexWrap: 'wrap', minHeight: 50, alignItems: 'center' }}>
            {presets.map((p) => (
              <Button
                key={p.label}
                disabled={preset === p}
                onClick={() => {
                  choosePreset(p);
                  setDraft({});
                }}
              >
                {p.label}
              </Button>
            ))}
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
