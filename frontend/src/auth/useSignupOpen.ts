import { usePublicSettings } from './usePublicSettings';

/**
 * Whether new accounts can sign up (backend OEE_ALLOW_SIGNUP). Undefined while loading or when the
 * backend can't be reached: the Register links stay hidden until the answer is a clear yes.
 */
export function useSignupOpen(): boolean | undefined {
  return usePublicSettings()?.signup;
}
