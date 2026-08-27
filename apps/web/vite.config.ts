import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3050,
    strictPort: true,
    allowedHosts: ["scrap.605081.xyz", ".605081.xyz"],
    proxy: {
      "/health": "http://127.0.0.1:9210",
      "/api": {
        target: "http://127.0.0.1:9210",
        ws: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 3050,
    strictPort: true,
    allowedHosts: ["scrap.605081.xyz", ".605081.xyz"],
  },
});
