import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Plain http-proxy streams responses unbuffered, so SSE from the API
      // passes through without extra config.
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
  },
});
