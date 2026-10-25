import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Button, Link, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { confirmPasswordReset } from '../../auth/authApi';
import { useSignupOpen } from '../../auth/useSignupOpen';
import AuthCard from '../AuthCard';
import AuthField from '../AuthField';

interface Form {
  token: string;
  password: string;
  password2: string;
}

function validate(form: Form): Partial<Form> {
  const errors: Partial<Form> = {};
  if (!form.token.trim()) errors.token = 'Please enter the PIN from the email';
  if (!form.password) errors.password = 'Please choose a new password';
  if (form.password2 !== form.password) errors.password2 = 'Passwords do not match';
  return errors;
}

// Step 2 of a password reset: the PIN from the email and the new password.
export default function PasswordChange() {
  const signupOpen = useSignupOpen();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({ token: '', password: '', password2: '' });
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(form) : {};

  const change = useMutation({
    mutationFn: () => confirmPasswordReset(form.token.trim(), form.password),
    onSuccess: () => {
      toast.success('Password changed. You can login now.');
      navigate('/login', { replace: true });
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  });

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(validate(form)).length === 0) change.mutate();
  };

  const set = (name: keyof Form) => (value: string) => setForm({ ...form, [name]: value });

  return (
    <AuthCard title="Change Password" loading={change.isPending} onSubmit={submit}>
      <Typography sx={{ mb: 3 }}>Enter the PIN sent to your email and choose a new password.</Typography>
      <AuthField
        name="token"
        label="PIN Code"
        value={form.token}
        onChange={set('token')}
        placeholder="Enter PIN from email"
        help="The reset code sent to your email"
        error={errors.token}
        autoComplete="one-time-code"
      />
      <AuthField
        name="password"
        label="New Password"
        type="password"
        value={form.password}
        onChange={set('password')}
        error={errors.password}
        autoComplete="new-password"
      />
      <AuthField
        name="password2"
        label="Repeat Password"
        type="password"
        value={form.password2}
        onChange={set('password2')}
        error={errors.password2}
        autoComplete="new-password"
      />
      <Button type="submit" variant="contained" fullWidth sx={{ mt: 1 }}>
        Change Password
      </Button>
      {signupOpen && (
        <Typography sx={{ mt: 3 }}>
          Don't have an account?{' '}
          <Link component={RouterLink} to="/register">
            Register here
          </Link>
        </Typography>
      )}
      <Typography sx={{ mt: 1 }}>
        Go back to{' '}
        <Link component={RouterLink} to="/login">
          Login
        </Link>
      </Typography>
    </AuthCard>
  );
}
