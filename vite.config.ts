import { defineConfig } from "vite";
import { visualizer } from '@aklinker1/rollup-plugin-visualizer';
import { resolve } from 'path';
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
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
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, './index.html'),
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