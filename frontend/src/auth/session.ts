// The login session.
//
// The backend keeps the session: after login the browser holds an HttpOnly session cookie
// that this app never sees and sends it with every request (also live sockets). This module
// only tracks whether someone is logged in, and who to tell when the session ends.
// To change how authentication works, change this module and authApi.ts.

let active = false;
let onUnauthorized: (() => void) | null = null;

/** Someone is logged in (after login, or after a reload found the backend session). */
export function startSession(): void {
  active = true;
}

/** Called when the backend answers 401 (session expired or ended elsewhere). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** The backend answered 401 while someone was logged in. */
export function notifyUnauthorized(): void {
  if (active && onUnauthorized) onUnauthorized();
}

const logoutListeners = new Set<() => void>();

/**
 * Run `listener` when the user logs out, e.g. to drop data kept in memory for them.
 * Returns a function that removes the listener.
 */
export function onLogout(listener: () => void): () => void {
  logoutListeners.add(listener);
  return () => logoutListeners.delete(listener);
}

/** Ends the session in the app and tells the logout listeners (the backend call is in authApi.ts). */
export function endSession(): void {
  active = false;
  for (const listener of logoutListeners) listener();
}
