import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    // Only http://localhost:5173 is in allowedOrigins for the callable
    // functions, so silently moving to 5174 when the port is busy turns into a
    // confusing CORS failure. Fail to start instead, and bind the hostname that
    // is on the allowlist rather than 127.0.0.1, which is a different origin.
    host: 'localhost',
    port: 5173,
    strictPort: true
  },
  define: {
    'process.env': {}
  }
})
