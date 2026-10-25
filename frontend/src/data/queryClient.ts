import { QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';

import { errorMessage } from './errors';

// One cache for the whole app. Pages that load the same list share it,
// and lists reload after a change (see invalidateQueries in ./queries).
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // A failed load shows one message; the same message from several lists is shown once.
    // Queries that explain the error on their page set meta.showsOwnError.
    onError: (error, query) => {
      if (query.meta?.showsOwnError) return;
      const message = `Something wrong! Please try again. Hint: ${errorMessage(error)}`;
      toast.error(message, { toastId: message });
    },
  }),
  defaultOptions: {
    queries: {
      // The backend answers errors on purpose (403, 404...): don't retry them.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
