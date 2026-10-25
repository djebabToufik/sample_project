import { useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router';
import { Button, Link, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';

import { getInvitation } from '../../auth/authApi';
import { useAuth } from '../../auth/AuthContext';
import { errorMessage } from '../../data/errors';
import AuthCard from '../AuthCard';
import AuthField from '../AuthField';

interface Form {
  password: string;
  password2: string;
}

function validate(form: Form): Partial<Form> {
  const errors: Partial<Form> = {};
  if (!form.password) errors.password = 'Please choose a password';
  if (form.password2 !== form.password) errors.password2 = 'Passwords do not match';
  return errors;
}

// The page an invitation email links to (/invitation?uid=…&token=…): the new user sets their
// password and is logged in. The link works once and expires (backend: users/invitations.py).
export default function Invitation() {
  const [params] = useSearchParams();
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';
  const { acceptInvitation } = useAuth();
  const [form, setForm] = useState<Form>({ password: '', password2: '' });
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(form) : {};

  const invitation = useQuery({
    queryKey: ['invitation', uid, token],
    queryFn: () => getInvitation(uid, token),
    enabled: Boolean(uid && token),
    retry: false,
    // The page says why the link does not work; no extra error message.
    meta: { showsOwnError: true },
  });

  // On success the app opens (AuthProvider), so only errors are handled here.
  const accept = useMutation({
    mutationFn: () => acceptInvitation(uid, token, form.password, form.password2),
  });

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(validate(form)).length === 0) accept.mutate();
  };

  const set = (name: keyof Form) => (value: string) => setForm({ ...form, [name]: value });

  const backToLogin = (
    <Typography sx={{ mt: 3 }}>
      Go to the{' '}
      <Link component={RouterLink} to="/login">
        Login
      </Link>
    </Typography>
  );

  if (!uid || !token || invitation.isError) {
    return (
      <AuthCard title="Invitation" onSubmit={() => undefined}>
        <Typography role="alert">
          This invitation link is not valid any more. Ask your administrator for a new one.
        </Typography>
        {backToLogin}
      </AuthCard>
    );
  }

  const invited = invitation.data;
  return (
    <AuthCard title="Welcome" loading={invitation.isPending || accept.isPending} onSubmit={submit}>
      {invited && (
        <Typography sx={{ mb: 3 }}>
          Hello {invited.first_name || invited.username}, you are invited to{' '}
          <strong>{invited.organization}</strong>. Choose a password for your username{' '}
          <strong>{invited.username}</strong>.
        </Typography>
      )}
      <AuthField
        name="password"
        label="Password"
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
      {accept.isError && (
        <Typography color="error" role="alert" sx={{ mb: 2 }}>
          {errorMessage(accept.error)}
        </Typography>
      )}
      <Button type="submit" variant="contained" fullWidth sx={{ mt: 1 }}>
        Set password and log in
      </Button>
      {backToLogin}
    </AuthCard>
  );
}
