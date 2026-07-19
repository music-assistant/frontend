import { defineConfig, mergeConfig } from "vite";
import { configDefaults } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "happy-dom",
      globals: true,
      css: false,
      setupFiles: [],
      server: {
        deps: {
          inline: ["vuetify"],
        },
      },
      // Ignore nested git worktrees so a sibling branch's tests under
      // ./.worktrees aren't picked up by this repo's suite.
      exclude: [...configDefaults.exclude, "**/.worktrees/**"],
    },
  }),
);
