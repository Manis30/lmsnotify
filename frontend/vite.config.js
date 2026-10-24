import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/send-mails': 'http://localhost:5000',
      '/status': 'http://localhost:5000',
      '/delivery-status': 'http://localhost:5000',
      '/campaigns': 'http://localhost:5000',
      '/messages': 'http://localhost:5000',
      '/templates': 'http://localhost:5000'
    }
  }
});
