import { defineConfig, mergeConfig } from "vite";
import "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      css: false,
      setupFiles: [],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.direnv/**",
        "**/result/**",
        "**/src-tauri/**",
      ],
    },
  }),
);
