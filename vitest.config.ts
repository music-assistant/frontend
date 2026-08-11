import { defineConfig, mergeConfig } from "vite";
import { configDefaults } from "vitest/config";
import viteConfig from "./vite.config";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // happy-dom is not spec-complete enough for DOMPurify: it silently drops
      // elements the sanitizer should keep. Tests that assert on rendered
      // markdown pin themselves to jsdom with an @vitest-environment docblock.
      environment: "happy-dom",
      globals: true,
      // The popout inset test asserts a real cascade result, so the app
      // stylesheet has to be compiled instead of stubbed out. Component styles
      // stay unprocessed, so the rest of the suite is unaffected.
      css: { include: [/src\/styles\/style\.css/] },
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
