// The backend is on the same site as the app (nginx in production, the Vite proxy in
// development), so the session cookie goes along. http/ws locally, https/wss in production.
const secure = window.location.protocol === 'https:';

export const url = window.location.origin;
export const wsurl = (secure ? 'wss://' : 'ws://') + window.location.host;

// Feature flags
export const FEATURE_OEE = true;
export const FEATURE_CMMS = true;
