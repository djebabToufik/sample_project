import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import PageLoading from '../components/PageLoading';
import { queryClient } from '../data/queryClient';
import PublicPages from '../PublicPages/PublicPages';
import { AuthContext, type Auth } from './AuthContext';
import {
  acceptInvitation as acceptInvitationApi,
  restoreSession,
  signIn,
  signOut,
  type Session,
} from './authApi';
import { endSession, setUnauthorizedHandler, startSession } from './session';

// Logged out: the public pages (login, register...). Logged in: the app (children).
// On start (and after a reload) the backend is asked whether this browser still has a session.
export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    restoreSession().then((restored) => {
      if (cancelled) return;
      if (restored) {
        startSession();
        setSession(restored);
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Forget the user's loaded data,
  // so the next user on this browser never sees it.
  const clearSession = useCallback(() => {
    endSession();
    queryClient.clear();
    setSession(null);
  }, []);

  const logout = useCallback(() => {
    signOut().catch(() => undefined);
    clearSession();
  }, [clearSession]);

  const login = useCallback(async (username: string, password: string) => {
    const next = await signIn(username, password);
    startSession();
    setSession(next);
  }, []);

  const acceptInvitation = useCallback(
    async (uid: string, token: string, password: string, password2: string) => {
      const next = await acceptInvitationApi(uid, token, password, password2);
      startSession();
      setSession(next);
    },
    [],
  );

  // Session ended on the backend (expired, password changed elsewhere): back to the login page.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const auth = useMemo<Auth>(
    () => ({
      profile: session?.profile ?? null,
      isAdmin: session?.profile.type === 'Admin',
      login,
      acceptInvitation,
      logout,
    }),
    [session, login, acceptInvitation, logout],
  );

  if (checking) return <PageLoading />;
  return <AuthContext.Provider value={auth}>{session ? children : <PublicPages />}</AuthContext.Provider>;
}
