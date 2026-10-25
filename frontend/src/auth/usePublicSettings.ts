import { useQuery } from '@tanstack/react-query';

import { fetchPublicSettings, type PublicSettings } from './authApi';

/** /api/auth/settings/, loaded once. Undefined while loading or when the backend can't be reached. */
export function usePublicSettings(): PublicSettings | undefined {
  const settings = useQuery({
    queryKey: ['public-settings'],
    queryFn: fetchPublicSettings,
    staleTime: Infinity,
  });
  return settings.data;
}
