/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    // Disable host check to allow dynamic ngrok domains
    // This prioritizes readability and ease of development
    allowedHosts: true,

    // Optional: Make sure the server listens on all network interfaces
    host: '0.0.0.0'
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
