import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://integrations.sh",
  integrations: [react()],
  build: {
    format: "directory",
  },
  vite: {
    // Allow access over the tailnet (by IP or .ts.net hostname). `true`
    // disables Vite's host check — fine for a dev/preview server on a private net.
    preview: { allowedHosts: true },
    server: { allowedHosts: true },
  },
});
