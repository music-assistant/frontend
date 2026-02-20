import { defineConfig, mergeConfig } from "vite";
import "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      globals: true,
      css: false,
      setupFiles: [],
      // https://vuetifyjs.com/en/getting-started/unit-testing/#using-vite
      server: {
        deps: {
          inline: ["vuetify"],
        },
      },
    },
  }),
);
