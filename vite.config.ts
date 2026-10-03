import { resolve } from "node:path";
import { defineConfig } from "vite";
import { adminPlugin } from "./scripts/vite-admin";

export default defineConfig({
  // GitHub Pages serves the site under /<repo>/: the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? "/",
  plugins: [adminPlugin()],
  build: {
    // Only the site pages: the admin page (admin.html) is served by the dev server alone.
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        rankings: resolve(__dirname, "rankings.html"),
        studios: resolve(__dirname, "studios.html"),
      },
    },
  },
});
