import { useId } from 'react';
import { FormControl, FormHelperText, Input, InputLabel } from '@mui/material';

interface AuthFieldProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  /** Hint under the field */
  help?: string;
  /** Shown instead of the hint, in red */
  error?: string;
  autoComplete?: string;
  placeholder?: string;
}

// Labelled text field of the login and account forms.
export default function AuthField({
  name,
  label,
  value,
  onChange,
  type = 'text',
  help,
  error,
  autoComplete,
  placeholder,
}: AuthFieldProps) {
  const id = useId();
  const message = error ?? help;
  return (
    <FormControl variant="standard" fullWidth sx={{ mb: 2 }} error={Boolean(error)}>
      <InputLabel htmlFor={id}>{label}</InputLabel>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-describedby={message ? `${id}-help` : undefined}
      />
      {message && <FormHelperText id={`${id}-help`}>{message}</FormHelperText>}
    </FormControl>
  );
}
