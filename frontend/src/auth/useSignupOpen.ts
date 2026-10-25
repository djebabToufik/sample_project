import { useQuery } from '@tanstack/react-query';

import { fetchPublicSettings } from './authApi';

/**
 * Whether new accounts can sign up (backend OEE_ALLOW_SIGNUP). Undefined while loading or when the
 * backend can't be reached: the Register links stay hidden until the answer is a clear yes.
 */
export function useSignupOpen(): boolean | undefined {
  const settings = useQuery({
    queryKey: ['public-settings'],
    queryFn: fetchPublicSettings,
    staleTime: Infinity,
  });
  return settings.data?.signup;
}
