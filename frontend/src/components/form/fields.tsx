import { useId } from 'react';
import { Button, FormHelperText, Grid, MenuItem, TextField, Typography } from '@mui/material';

// Form fields of the admin forms. Each one takes a grid cell: full width, or half
// width from tablet size on.

type Width = 'full' | 'half';
const gridSize = (width: Width) => (width === 'half' ? { xs: 12, sm: 6 } : { xs: 12 });

interface BaseProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown in red under the field */
  error?: string;
  required?: boolean;
  width?: Width;
}

export function TextInput({
  label,
  value,
  onChange,
  error,
  required,
  width = 'full',
  type = 'text',
}: BaseProps & { type?: 'text' | 'email' | 'number' }) {
  return (
    <Grid size={gridSize(width)}>
      <TextField
        fullWidth
        label={label}
        type={type}
        value={value}
        required={required}
        error={Boolean(error)}
        helperText={error}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </Grid>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectInput({
  label,
  value,
  onChange,
  error,
  required,
  width = 'full',
  options,
}: BaseProps & { options: Option[] }) {
  return (
    <Grid size={gridSize(width)}>
      <TextField
        select
        fullWidth
        label={label}
        value={value}
        required={required}
        error={Boolean(error)}
        helperText={error}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
  );
}

/** Local date and time (`YYYY-MM-DDTHH:mm`, see data/dates.ts). */
export function DateTimeInput({ label, value, onChange, error, required, width = 'half' }: BaseProps) {
  return (
    <Grid size={gridSize(width)}>
      <TextField
        fullWidth
        label={label}
        type="datetime-local"
        value={value}
        required={required}
        error={Boolean(error)}
        helperText={error}
        onChange={(e) => onChange(e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </Grid>
  );
}

interface FileInputProps {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  /** Larger files are refused with a message */
  maxBytes?: number;
  accept?: string;
  error?: string;
  onError?: (message: string | undefined) => void;
}

export function FileInput({ label, file, onChange, maxBytes, accept, error, onError }: FileInputProps) {
  const id = useId();
  return (
    <Grid size={12}>
      <Button variant="outlined" component="label" htmlFor={id}>
        {label}
        <input
          id={id}
          type="file"
          hidden
          accept={accept}
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            e.target.value = '';
            if (chosen && maxBytes && chosen.size > maxBytes) {
              onChange(null);
              onError?.(
                `The file is bigger than ${Math.round(maxBytes / 1_000_000)} MB. Please choose another file.`,
              );
              return;
            }
            onError?.(undefined);
            onChange(chosen);
          }}
        />
      </Button>
      {file && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          Selected: {file.name}
        </Typography>
      )}
      {error && <FormHelperText error>{error}</FormHelperText>}
    </Grid>
  );
}
