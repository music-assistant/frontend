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
      setupFiles: ["./tests/setup/failOnUnhandledErrors.ts"],
      // Errors that escape a test must never be silently dropped; the setup
      // file above additionally surfaces them in the pass/fail tally.
      dangerouslyIgnoreUnhandledErrors: false,
      server: {
        deps: {
          inline: ["vuetify"],
        },
      },
      // Ignore nested git worktrees so a sibling branch's tests under
      // ./.claude/worktrees (or the older ./.worktrees) aren't picked up by
      // this repo's suite.
      exclude: [
        ...configDefaults.exclude,
        "**/.claude/worktrees/**",
        "**/.worktrees/**",
      ],
    },
  }),
);
