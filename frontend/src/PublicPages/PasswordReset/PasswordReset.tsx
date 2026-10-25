import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Button, Link, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { requestPasswordReset } from '../../auth/authApi';
import { useSignupOpen } from '../../auth/useSignupOpen';
import AuthCard from '../AuthCard';
import AuthField from '../AuthField';

// Step 1 of a password reset: send a PIN to the account's email.
export default function PasswordReset() {
  const signupOpen = useSignupOpen();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();

  const send = useMutation({
    mutationFn: () => requestPasswordReset(email),
    onSuccess: (sent) => {
      if (sent) navigate('/password-change', { replace: true });
      else toast.error('Something went wrong. Please try again.');
    },
    onError: () => toast.error('Something went wrong. Please try again.'),
  });

  const submit = () => {
    if (!email.trim()) return setError('Please enter your email');
    setError(undefined);
    send.mutate();
  };

  return (
    <AuthCard title="Password Reset" loading={send.isPending} onSubmit={submit}>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Forgot your password? Enter your email below and we will send you a code to reset it.
      </Typography>
      <AuthField
        name="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        help="Enter the email registered to your account"
        error={error}
        autoComplete="email"
      />
      <Button type="submit" variant="contained" fullWidth sx={{ mt: 1 }}>
        Send Reset Email
      </Button>
      {signupOpen && (
        <Typography sx={{ mt: 3 }}>
          No account?{' '}
          <Link component={RouterLink} to="/register">
            Register here
          </Link>
        </Typography>
      )}
      <Typography sx={{ mt: 1 }}>
        Remember your password?{' '}
        <Link component={RouterLink} to="/login">
          Login
        </Link>
      </Typography>
    </AuthCard>
  );
}
