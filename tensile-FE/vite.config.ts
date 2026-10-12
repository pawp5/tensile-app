import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: {
    rollupOptions: {
      output: {
        // Libraries change rarely: separate files let browsers keep them cached between deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          web3: ['wagmi', 'viem', '@tanstack/react-query'],
        },
      },
    },
  },
});