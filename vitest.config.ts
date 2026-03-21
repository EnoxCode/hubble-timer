import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@hubble/sdk', replacement: path.resolve(__dirname, '__mocks__/@hubble/sdk.ts') },
      { find: 'hubble-dash-ui/styles/dash-base.css', replacement: path.resolve(__dirname, '__mocks__/empty.css') },
      { find: 'hubble-dash-ui', replacement: path.resolve(__dirname, '__mocks__/hubble-dash-ui.tsx') },
    ],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
