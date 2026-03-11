import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/circle-graph/',
  server: {
    port: 5188,
    strictPort: true,
  },
})
