import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { webspatial } from '@webspatial/builder/vite';

export default defineConfig({
  plugins: [react(), webspatial()],
  server: { port: 5173 }
});
