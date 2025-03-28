import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/retro-app/',
  define: {
    'process.env': {} // This might help resolve some issues
  }
})
