import { createContext, useContext } from 'react';

import type { UserProfile } from '../data/types';

export interface Auth {
  /** The logged-in user's profile; null when logged out */
  profile: UserProfile | null;
  isAdmin: boolean;
  /** Signs in; rejects with a SignInError (see authApi.ts) */
  login: (username: string, password: string) => Promise<void>;
  /** Sets the password from an invitation link and logs in (rejects with the backend's reason) */
  acceptInvitation: (uid: string, token: string, password: string, password2: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<Auth | null>(null);

/** The login session (inside AuthProvider). */
export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>');
  return auth;
}
