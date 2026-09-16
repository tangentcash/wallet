import { defineConfig, type Plugin } from "vite";
import { visualizer } from '@aklinker1/rollup-plugin-visualizer';
import { resolve } from 'path';
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  clearScreen: false,
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    visualizer({
      filename: resolve(__dirname, './bundle.html'),
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: { buffer: 'buffer/' },
  },
  define: {
    global: 'globalThis',
    'process.env': {},
  },
  optimizeDeps: {
    include: ['buffer']
  },
  build: {
    esbuild: {
      legalComments: 'none',
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, './index.html'),
      },
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules'))
            return;
          if (id.endsWith('.json'))
            return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))
            return 'react';
          if (id.includes('react-router'))
            return 'react-router';
        },
      }
    }
  },
  server: {
    port: 18421,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 18422,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
