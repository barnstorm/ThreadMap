import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the local server so the web app is same-origin in dev.
      "/api": { target: process.env.VITE_API_BASE ?? "http://localhost:4000", changeOrigin: true },
      "/health": { target: process.env.VITE_API_BASE ?? "http://localhost:4000", changeOrigin: true },
    },
  },
});
