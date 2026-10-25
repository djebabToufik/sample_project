import { isAxiosError } from 'axios';

/**
 * Readable message for a failed request: the backend's `detail` when it sends one,
 * or its field errors ({"username": ["already exists"]} -> "username: already exists").
 */
export function errorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as unknown;
    if (data && typeof data === 'object') {
      const { detail } = data as { detail?: unknown };
      if (typeof detail === 'string') return detail;
      const fields = Object.entries(data as Record<string, unknown>)
        .map(([field, messages]) => {
          const text = Array.isArray(messages) ? messages.join(' ') : messages;
          if (typeof text !== 'string' || !text) return null;
          return field === 'non_field_errors' ? text : `${field}: ${text}`;
        })
        .filter(Boolean);
      if (fields.length) return fields.join(' ');
    }
  }
  return error instanceof Error ? error.message : String(error);
}
