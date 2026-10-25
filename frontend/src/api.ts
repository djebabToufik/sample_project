import axios, { AxiosError } from 'axios';
import { notifyUnauthorized } from './auth/session';
import { url } from './Config';

// Shared axios instance for all backend calls.
// - Paths are relative to the backend: api.get('/api/assets/')
// - The browser sends the session cookie itself (same site); changes (POST, PATCH, DELETE)
//   carry Django's CSRF token from the csrftoken cookie in the X-CSRFToken header
// - A 401 response (session expired or ended) logs the user out
const api = axios.create({ baseURL: url, xsrfCookieName: 'csrftoken', xsrfHeaderName: 'X-CSRFToken' });

// True when `target` points at our backend API, never at another site.
export function isOwnApiUrl(target: string | null | undefined): boolean {
  if (!target) return false;

  try {
    const backend = new URL(url);
    const parsed = new URL(target, backend);
    return parsed.origin === backend.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/** Absolute URL for `target`; relative paths like /api/... point at the backend. */
export function backendUrl(target: string): string {
  return new URL(target, url).toString();
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) notifyUnauthorized();
    return Promise.reject(error);
  },
);

export default api;
