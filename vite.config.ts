import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { APP_NAME, APP_SLUG } from './src/config/app';

// Fills %APP_NAME% placeholders in index.html so the tab title comes from the
// same constant as the in-app labels.
function appNameHtml(): Plugin {
  return {
    name: 'app-name-html',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', APP_NAME),
  };
}

// GitHub Pages serves project sites from /<repo-name>/, so the production
// build needs that base path; local dev stays at '/'.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? `/${APP_SLUG}/` : '/',
  plugins: [react(), appNameHtml()],
}));
