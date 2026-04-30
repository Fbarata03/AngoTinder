import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://angotinder.onrender.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    // Target modern browsers — smaller/faster output
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Framer Motion is large — isolate so it only loads when needed
          if (id.includes('framer-motion') || id.includes('motion/react')) return 'motion';
          // React core — always needed, cache aggressively
          if (id.includes('react-dom') || id.includes('react-router')) return 'react';
          // Everything else from node_modules in one vendor chunk
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
})
