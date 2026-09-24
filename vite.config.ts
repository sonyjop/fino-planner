import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites from /<repo-name>/, so the production
// build needs that base path; local dev stays at '/'.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/finoplan/' : '/',
  plugins: [react()],
}));
