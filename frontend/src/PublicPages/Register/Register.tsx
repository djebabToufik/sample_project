import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router';
import { Alert, Button, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { register, type Registration } from '../../auth/authApi';
import { useSignupOpen } from '../../auth/useSignupOpen';
import { errorMessage } from '../../data/errors';
import AuthCard from '../AuthCard';
import AuthField from '../AuthField';

type Errors = Partial<Record<keyof Registration, string>>;

function validate(form: Registration): Errors {
  const errors: Errors = {};
  if (!form.username.trim()) errors.username = 'Please enter a username';
  if (!form.organization.trim()) errors.organization = 'Please enter your organization';
  if (!form.email.trim()) errors.email = 'Please enter your email';
  else if (!/^[^\s@]+@[^\s@]+$/.test(form.email)) errors.email = 'Please enter a valid email';
  if (!form.password) errors.password = 'Please choose a password';
  if (form.password2 !== form.password) errors.password2 = 'Passwords do not match';
  return errors;
}

export default function Register() {
  const navigate = useNavigate();
  const signupOpen = useSignupOpen();
  const [form, setForm] = useState<Registration>({
    username: '',
    organization: '',
    email: '',
    password: '',
    password2: '',
  });
  // Errors are shown once the user tried to submit.
  const [submitted, setSubmitted] = useState(false);
  const errors = submitted ? validate(form) : {};

  const create = useMutation({
    mutationFn: () => register(form),
    onSuccess: () => {
      toast.success('Account created. You can login now.');
      navigate('/login', { replace: true });
    },
    onError: (error) => toast.error(`Error: ${errorMessage(error)}`),
  });

  const submit = () => {
    setSubmitted(true);
    if (Object.keys(validate(form)).length === 0) create.mutate();
  };

  const field = (name: keyof Registration, label: string, type: 'text' | 'email' | 'password' = 'text') => (
    <AuthField
      name={name}
      label={label}
      type={type}
      value={form[name]}
      onChange={(value) => setForm({ ...form, [name]: value })}
      error={errors[name]}
    />
  );

  if (signupOpen === false) {
    return (
      <AuthCard title="Create Your Account" onSubmit={() => navigate('/login')}>
        <Alert severity="info">
          Sign-up is closed. Ask an administrator of your organization for an invitation.
        </Alert>
        <Button component={RouterLink} to="/login" fullWidth sx={{ mt: 2 }}>
          Login
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create Your Account" loading={create.isPending} onSubmit={submit}>
      {field('username', 'Username')}
      {field('organization', 'Organization')}
      {field('email', 'Email', 'email')}
      {field('password', 'Password', 'password')}
      {field('password2', 'Repeat Password', 'password')}
      <Button type="submit" variant="contained" fullWidth sx={{ mt: 1 }}>
        Register
      </Button>
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
        <Button component={RouterLink} to="/login">
          Login
        </Button>
      </Stack>
    </AuthCard>
  );
}
