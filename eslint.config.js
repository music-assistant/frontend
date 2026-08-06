import pluginVue from "eslint-plugin-vue";
import {
  defineConfigWithVueTs,
  vueTsConfigs,
} from "@vue/eslint-config-typescript";
import eslintConfigPrettier from "eslint-config-prettier";
import oxlint from "eslint-plugin-oxlint";

export default defineConfigWithVueTs(
  // Replaces the old `ignorePatterns`. node_modules is ignored by default.
  {
    name: "app/ignores",
    ignores: [
      "dist",
      "dev-dist",
      "coverage",
      // Nested git worktrees hold another branch's checkout; linting them
      // would report — and with `--fix`, rewrite — files outside this branch.
      "**/.claude/worktrees/**",
      "**/.worktrees/**",
    ],
  },
  vueTsConfigs.eslintRecommended,
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  {
    name: "app/overrides",
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/no-v-text-v-html-on-component": "off",
      "vue/no-v-html": "off",
      "vue/attribute-hyphenation": ["error", "always", { ignore: ["onLoad"] }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      // Successor to the old `ban-types` rule the project already opted out of
      // (see the inline disables it used). Empty/`{}` interface patterns are
      // used intentionally here (e.g. Vue SFC shims, nominal interfaces).
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
  // `eslint-config-prettier` disables stylistic rules that conflict with
  // Prettier (formatting lives in the standalone `format` script). `oxlint`
  // then disables rules already covered by Oxlint, which runs first and
  // faster, to avoid double-reporting.
  eslintConfigPrettier,
  oxlint.configs["flat/recommended"],
  {
    // Must stay after `eslintConfigPrettier`, which turns
    // `vue/html-self-closing` off wholesale — configuring it any earlier
    // leaves it disabled. Prettier only dictates the `void` style (it always
    // self-closes `<img>` and friends), which is what `void: "always"` asks
    // for, so the two agree and the remaining tag styles stay ours to pick.
    name: "app/overrides-post-prettier",
    rules: {
      "vue/html-self-closing": [
        "error",
        {
          html: { void: "always", normal: "never", component: "always" },
          svg: "always",
          math: "always",
        },
      ],
    },
  },
);
