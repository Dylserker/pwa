import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/pwa/',
  plugins: [react()],
  build: {
    // Do not inline assets as base64 (fonts) — emit them as separate files
    assetsInlineLimit: 0
  }
})
