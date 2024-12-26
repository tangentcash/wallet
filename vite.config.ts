import { defineConfig } from "vite";
// @ts-expect-error - node.js
import { resolve } from 'path'
import react from "@vitejs/plugin-react";

// @ts-expect-error - node.js
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        // @ts-expect-error - node.js
        main: resolve(__dirname, './index.html'),
      }
    }
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
