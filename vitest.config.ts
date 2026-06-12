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
      // local git worktrees contain stale copies of the test suite
      exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**"],
    },
  }),
);
