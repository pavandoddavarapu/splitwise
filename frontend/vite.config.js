import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  build: {
    // Output to a directory that Django's collectstatic can find.
    // settings.py adds REPO_ROOT/frontend/dist to STATICFILES_DIRS.
    outDir: "dist",
    // Emit assets (JS, CSS, images) into a subdirectory so they don't
    // clash with Django's own static files at the root of STATIC_ROOT.
    assetsDir: "assets",
  },

  server: {
    // In development, proxy /api/ requests to Django running on port 8000.
    // This avoids CORS issues during local dev without needing CORS headers
    // (the production setup is same-origin — see DECISIONS.md D-001).
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
