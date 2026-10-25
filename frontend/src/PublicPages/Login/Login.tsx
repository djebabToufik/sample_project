import { useState } from 'react';
import { Link as RouterLink } from 'react-router';
import { Alert, Button, Stack } from '@mui/material';
import { useMutation } from '@tanstack/react-query';

import { useAuth } from '../../auth/AuthContext';
import { SignInError, type SignInFailure } from '../../auth/authApi';
import { usePublicSettings } from '../../auth/usePublicSettings';
import { useSignupOpen } from '../../auth/useSignupOpen';
import AuthCard from '../AuthCard';
import AuthField from '../AuthField';

const failureText: Record<SignInFailure, string> = {
  'wrong-credentials': 'Username or password are wrong! Please try again',
  'no-profile': 'This account has no profile yet. Please contact your administrator.',
  'server-error': 'Login failed because the server did not answer correctly. Please try again in a moment.',
};

export default function Login() {
  const { login } = useAuth();
  const signupOpen = useSignupOpen();
  const demo = usePublicSettings()?.demo;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useMutation({ mutationFn: () => login(username, password) });

  const failure = signIn.error instanceof SignInError ? signIn.error.reason : signIn.error && 'server-error';

  return (
    <AuthCard title="Login" loading={signIn.isPending} onSubmit={() => signIn.mutate()}>
      {demo && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          aria-label="Demo account"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setUsername(demo.username);
                setPassword(demo.password);
              }}
            >
              Fill in
            </Button>
          }
        >
          Public demo: username <strong>{demo.username}</strong>, password <strong>{demo.password}</strong>.
          The data is reset every night.
        </Alert>
      )}
      {failure && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {failureText[failure]}
        </Alert>
      )}
      <AuthField
        name="username"
        label="Username"
        value={username}
        onChange={setUsername}
        help="Enter your username"
        autoComplete="username"
      />
      <AuthField
        name="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        help="Enter your password"
        autoComplete="current-password"
      />
      <Stack spacing={1} sx={{ mt: 1 }}>
        <Button type="submit" fullWidth variant="contained" size="large">
          Login
        </Button>
        {signupOpen && (
          <Button component={RouterLink} to="/register" variant="contained" fullWidth>
            Register
          </Button>
        )}
        <Button component={RouterLink} to="/password-reset-email" fullWidth>
          Reset Password
        </Button>
      </Stack>
    </AuthCard>
  );
}
