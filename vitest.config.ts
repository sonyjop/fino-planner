import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 'node' by default — the service/repository layer this app leans on for logic is DOM-free.
// Component tests opt into jsdom per-file with a `// @vitest-environment jsdom` docblock.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
});
