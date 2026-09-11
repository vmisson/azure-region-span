import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
    root: fileURLToPath(new URL('./www', import.meta.url)),
    server: {
        host: '127.0.0.1',
        port: 8080,
        proxy: {
            '/api': {
                target: process.env.LATENCY_API_URL || 'https://func-latency-api-001.azurewebsites.net',
                changeOrigin: true,
                proxyTimeout: 20000
            }
        }
    }
});