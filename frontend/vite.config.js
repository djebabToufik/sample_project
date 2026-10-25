import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server: backend calls go through this proxy to the Docker stack (nginx on port 80), so the
// browser only talks to the dev server, like to nginx in production (session cookie, CSRF).
const backend = process.env.VITE_BACKEND || 'http://localhost:80';
const toBackend = { target: backend };

export default defineConfig({
  plugins: [react()],
  server: {
    // Same port as the old Create React App dev server.
    port: 3000,
    proxy: {
      '/api': toBackend,
      '/admin': toBackend,
      '/staticapi': toBackend,
      '/ws': { ...toBackend, ws: true },
    },
  },
  build: {
    // Keep CRA's output folder: the Dockerfile and nginx serve frontend/build.
    outDir: 'build',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // React, the router and MUI change rarely: one file the browser keeps
            // across releases. Libraries of single pages (charts, calendar) stay with the pages that use them.
            {
              name: 'framework',
              test: /node_modules[/\\]((react|react-dom|scheduler|react-router)[/\\]|@emotion[/\\]|@mui[/\\](?!x-))/,
            },
          ],
        },
      },
    },
  },
});
