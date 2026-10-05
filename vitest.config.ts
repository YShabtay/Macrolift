import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts on purpose: tests don't need the PWA/React plugins, and the logic under test is plain TypeScript.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Dates are built in local time throughout the app; pin the zone so "Sunday-start week" assertions can't depend on the machine running them.
    env: { TZ: 'Asia/Jerusalem' },
  },
});
