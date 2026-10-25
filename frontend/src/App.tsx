import { useEffect } from 'react';
import { BrowserRouter } from 'react-router';
import { ToastContainer } from 'react-toastify';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClientProvider } from '@tanstack/react-query';

import AppRoutes from './AppMain/Routes';
import AuthProvider from './auth/AuthProvider';
import { brand, theme } from './branding';
import { queryClient } from './data/queryClient';
import AppLayout from './Layout/AppLayout';

export default function App() {
  useEffect(() => {
    document.title = brand.title;
  }, []);

  return (
    <ThemeProvider theme={theme}>
      {/* One toast container for the whole app (pages only call toast.*) */}
      <ToastContainer />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Logged out: public pages. Logged in: one layout around all app routes. */}
          <AuthProvider>
            <AppLayout>
              <AppRoutes />
            </AppLayout>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
