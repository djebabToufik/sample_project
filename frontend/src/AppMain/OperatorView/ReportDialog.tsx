import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  Input,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';

import type { LineEventInput } from '../../data/queries';
import type { Cell, Fault, Product } from '../../data/types';
import { faultStates, productionStates, reportState } from './lineActions';

interface ReportDialogProps {
  open: boolean;
  /** Current state of the line */
  state: string | undefined;
  machine: string;
  /** Cells and faults of this line */
  cells: Cell[];
  faults: Fault[];
  products: Product[];
  busy?: boolean;
  onReport: (event: LineEventInput) => void;
  /** Only possible for a production report; a fault must be reported. */
  onCancel: () => void;
}

const empty = { cell: '', fault: '', product: '', quantity: '0', scrap: '0' };

// Report a fault (cell + fault) or production (product, quantity, scrap).
export default function ReportDialog({
  open,
  state,
  machine,
  cells,
  faults,
  products,
  busy = false,
  onReport,
  onCancel,
}: ReportDialogProps) {
  const [form, setForm] = useState(empty);
  const isFault = state !== undefined && faultStates.includes(state);
  const isProduction = state !== undefined && productionStates.includes(state);
  const set = (field: keyof typeof empty) => (value: string) => setForm({ ...form, [field]: value });

  const submit = () => {
    if (!state) return;
    onReport({
      machine,
      state: reportState[state],
      // Empty choices are left out (no cell / fault / product).
      ...(form.cell && { cell: form.cell }),
      ...(form.fault && { fault: form.fault }),
      ...(form.product && { product: form.product }),
      quantity: Number(form.quantity) || 0,
      scrap: Number(form.scrap) || 0,
    });
    setForm(empty);
  };

  const select = (
    field: 'cell' | 'fault' | 'product',
    label: string,
    help: string,
    options: { uuid: string; name: string }[],
  ) => (
    <FormControl variant="standard" fullWidth sx={{ m: 1 }}>
      <InputLabel id={`${field}-label`}>{label}</InputLabel>
      <Select labelId={`${field}-label`} value={form[field]} onChange={(e) => set(field)(e.target.value)}>
        {options.map((option) => (
          <MenuItem key={option.uuid} value={option.uuid}>
            {option.name}
          </MenuItem>
        ))}
      </Select>
      <FormHelperText>{help}</FormHelperText>
    </FormControl>
  );

  const number = (field: 'quantity' | 'scrap', label: string, help: string) => (
    <FormControl variant="standard" fullWidth sx={{ m: 1 }}>
      <Input
        placeholder={label}
        type="number"
        autoComplete="off"
        value={form[field]}
        onChange={(e) => set(field)(e.target.value)}
        inputProps={{ 'aria-label': label, min: 0 }}
      />
      <FormHelperText>
        <strong>{label}</strong>
      </FormHelperText>
      <FormHelperText>{help}</FormHelperText>
    </FormControl>
  );

  return (
    <Dialog open={open} fullWidth aria-labelledby="report-dialog-title">
      <DialogTitle id="report-dialog-title">Report</DialogTitle>
      <DialogContent>
        {isFault && (
          <>
            {select('cell', 'Cell', 'Select the cell where the problem happened for this machine', cells)}
            {select('fault', 'Fault', 'Select the fault that happened to this machine', faults)}
          </>
        )}
        {isProduction && (
          <>
            {select(
              'product',
              'Product',
              'Select the product you want to report',
              products.map((p) => ({ uuid: p.uuid, name: p.product_name })),
            )}
            {number('quantity', 'Quantity produced', 'How many piece you produced')}
            {number('scrap', 'Scrap produced', 'How many scrap piece you produced')}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {!isFault && (
          <Button onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button onClick={submit} variant="contained" disabled={busy}>
          Report
        </Button>
      </DialogActions>
    </Dialog>
  );
}
