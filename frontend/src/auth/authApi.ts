import { isAxiosError } from 'axios';

import api from '../api';
import type { UserProfile } from '../data/types';

// Backend calls of the login and account pages. The session itself is an HttpOnly cookie set
// by the backend (see session.ts); changes carry the CSRF header (see api.ts).

export interface Session {
  profile: UserProfile;
}

/** Answer of /api/auth/session/ and /api/auth/login/ (no profile: e.g. a Django superuser). */
interface SessionResponse {
  profile: UserProfile | null;
}

/** Why signing in failed, as shown on the login page. */
export type SignInFailure = 'wrong-credentials' | 'no-profile' | 'server-error';

export class SignInError extends Error {
  constructor(readonly reason: SignInFailure) {
    super(reason);
  }
}

const hasCsrfCookie = () => document.cookie.split('; ').some((c) => c.startsWith('csrftoken='));

/** Logging in (also through an invitation) needs the CSRF cookie, which the session check sets. */
async function ensureCsrfCookie(): Promise<void> {
  if (!hasCsrfCookie()) await api.get('/api/auth/session/').catch(() => undefined);
}

export async function signIn(username: string, password: string): Promise<Session> {
  await ensureCsrfCookie();

  let body: SessionResponse;
  try {
    body = (await api.post<SessionResponse>('/api/auth/login/', { username, password })).data;
  } catch (error) {
    // The backend answers 400 for a wrong username or password.
    const status = isAxiosError(error) ? error.response?.status : undefined;
    throw new SignInError(status === 400 ? 'wrong-credentials' : 'server-error');
  }
  if (!body?.profile) {
    await signOut().catch(() => undefined);
    throw new SignInError('no-profile');
  }
  return { profile: body.profile };
}

/** The session the backend still has for this browser (e.g. after a reload); null when logged out. */
export async function restoreSession(): Promise<Session | null> {
  try {
    const body = (await api.get<SessionResponse>('/api/auth/session/')).data;
    return body?.profile ? { profile: body.profile } : null;
  } catch {
    // 401 (logged out) or backend unreachable: show the login page.
    return null;
  }
}

/** Who an invitation link is for; rejects when the link is broken, used or expired. */
export interface InvitationInfo {
  username: string;
  first_name: string;
  organization: string;
}

export async function getInvitation(uid: string, token: string): Promise<InvitationInfo> {
  return (await api.get<InvitationInfo>('/api/auth/invitation/', { params: { uid, token } })).data;
}

/** Sets the password of an invited user; the backend logs them in. */
export async function acceptInvitation(
  uid: string,
  token: string,
  password: string,
  password2: string,
): Promise<Session> {
  await ensureCsrfCookie();
  const body = (
    await api.post<SessionResponse>('/api/auth/invitation/accept/', { uid, token, password, password2 })
  ).data;
  if (!body?.profile) throw new Error('This account has no profile yet. Please contact your administrator.');
  return { profile: body.profile };
}

/** Ends the session on the backend. */
export async function signOut(): Promise<void> {
  await api.post('/api/auth/logout/');
}

export interface Registration {
  username: string;
  organization: string;
  email: string;
  password: string;
  password2: string;
}

export const register = (data: Registration) => api.post('/api/auth/signup/', data);

/** Sends a reset PIN by email. Resolves to false when the backend does not confirm. */
export async function requestPasswordReset(email: string): Promise<boolean> {
  const response = await api.post<{ status?: string }>('/api/auth/password-reset/', { email });
  return response.data?.status === 'OK';
}

/** Sets a new password with the PIN from the reset email. */
export const confirmPasswordReset = (token: string, password: string) =>
  api.post('/api/auth/password-reset/confirm/', { token, password });

/** Answer of /api/auth/settings/: what the public pages need to know before login. */
export interface PublicSettings {
  /** Sign-up open (backend OEE_ALLOW_SIGNUP) */
  signup: boolean;
}

export const fetchPublicSettings = async () => (await api.get<PublicSettings>('/api/auth/settings/')).data;
