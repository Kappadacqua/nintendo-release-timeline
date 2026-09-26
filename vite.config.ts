import { resolve } from "node:path";
import { defineConfig } from "vite";
import { adminPlugin } from "./scripts/vite-admin";

export default defineConfig({
  plugins: [adminPlugin()],
  build: {
    // Only the site: the admin page (admin.html) is served by the dev server alone.
    rollupOptions: { input: resolve(__dirname, "index.html") },
  },
});
