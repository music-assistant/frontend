/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution');

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
    'vue/setup-compiler-macros': true,
  },
  extends: [
    'plugin:vue/vue3-recommended',
    'eslint:recommended',
    '@vue/eslint-config-typescript/recommended',
    '@vue/eslint-config-prettier',
  ],
  parserOptions: {
    ecmaVersion: 2021,
  },
  plugins: [],
  rules: {
    'prettier/prettier': [
      'error',
      {
        endOfLine: 'auto',
      },
    ],
    semi: ['error', 'always'],
    'no-unused-vars': 1,
    indent: ['error', 2, { SwitchCase: 1 }],
    quotes: ['error', 'single'],
    'vue/attribute-hyphenation': 0,
    'vue/multi-word-component-names': 0,
    'vue/no-v-html': 0,
    'vue/no-v-text-v-html-on-component': 0,
    'object-curly-spacing': ['warn', 'always'],
    'comma-dangle': [
      'warn',
      {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'ignore',
      },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
