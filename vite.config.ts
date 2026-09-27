import { resolve } from "node:path";
import { defineConfig } from "vite";
import { adminPlugin } from "./scripts/vite-admin";

export default defineConfig({
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
