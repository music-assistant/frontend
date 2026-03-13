# Music Assistant frontend (Vue PWA)

The Music Assistant frontend/panel is developed in Vue, development instructions below.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
   1. Run `Extensions: Show Built-in Extensions` from VSCode's command palette
   2. Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

```sh
nvm use node
yarn install
```

### Compile and Hot-Reload for Development

```sh
yarn dev
```

This will launch an auto-reload development environment (usually at http://localhost:3000)
Open the url in the browser and a popup will ask the location of the MA server.
You can either connect to a locally launched dev server or an existing running server on port 8095.

### Type-Check, Compile and Minify for Production

```sh
yarn build
```

### Lint with [ESLint](https://eslint.org/)

```sh
yarn lint
```

## UI Framework

This project is migrating from **Vuetify** to **[shadcn-vue](https://www.shadcn-vue.com/)** as its primary UI component library.

## Development Guidelines

### Components

- **Size limit**: Keep components under 300–400 lines. If a component grows beyond this, split it into smaller, focused sub-components.
- **Single responsibility**: Each component should do one thing well. Extract repeated logic or UI patterns into reusable components.
- **Composition over complexity**: Prefer composing small components rather than building monolithic ones with many responsibilities.

### UI Components

- **Use shadcn-vue**: All new UI should use [shadcn-vue](https://www.shadcn-vue.com/) components located in `src/components/ui/`. Do not introduce new Vuetify components.
- **Extend, don't override**: If a shadcn-vue component needs customization, extend it via props or slots rather than overriding styles globally.
- **Avoid inline styles**: Use Tailwind utility classes for styling. Avoid `style=""` attributes except for dynamic values that cannot be expressed as classes.

### TypeScript

- **Always type props and emits**: Define explicit types for all component props and emits — avoid `any`.
- **Prefer `interface` for object shapes**: Use `interface` for defining data shapes and `type` for unions/intersections.
- **No implicit `any`**: Every function parameter and return value should be typed or clearly inferrable.

### State & Composables

- **Extract reusable logic into composables**: Any stateful logic shared between two or more components belongs in a `composable` under `src/composables/`.
- **Keep `<script setup>` lean**: Heavy logic (data fetching, transformations) should live in composables, not inline in the component.

### Helpers & Utilities

- **Pure functions go in `src/helpers/`**: Any standalone utility function (e.g. string manipulation, date formatting, data transformation) must be placed in `src/helpers/` rather than inlined in a component or composable.
- **One file per concern**: Group related helpers in a named file (e.g. `src/helpers/string.ts`, `src/helpers/date.ts`). Avoid a single catch-all `utils.ts`.
- **Test every helper**: Each helper file must have a corresponding test file in `tests/helpers/` (e.g. `tests/helpers/string.test.ts`). Helpers with no test coverage should not be merged.

### API Calls & User Feedback

- **Always show feedback on API calls**: Every API call must be wrapped with user feedback:
  - On success: call `toast.success(...)` with a clear confirmation message.
  - On failure: call `toast.error(...)` with a meaningful error message — never silently swallow errors.
- **Example pattern**:
  ```ts
  try {
    await api.doSomething()
    toast.success("Action completed successfully")
  } catch (e) {
    toast.error("Failed to complete action")
  }
  ```
- **Do not use `console.error` as a substitute** for user-facing feedback on API errors (or for meaningful calls).

### General Best Practices

- **No magic numbers/strings**: Extract constants with descriptive names.
- **Meaningful naming**: Variables, functions, and components should clearly describe their purpose. Avoid abbreviations unless universally understood.
- **Keep templates readable**: If a template expression is complex, move it to a computed property.
- **Clean up side effects**: Always clean up event listeners and intervals in `onUnmounted`; manually created watchers outside component `setup` or manual effect scopes must also be cleaned up.
- **Accessibility**: Use semantic HTML elements and provide `aria-*` attributes where appropriate.

---

# Translation Management

We use Lokalise to manage the translation files for the Music Assistant frontend

[<img src="https://github.com/lokalise/i18n-ally/raw/screenshots/lokalise-logo.png?raw=true" alt="Lokalise logo" width="275px">](https://lokalise.com)

### Contributing

If you wish to assist in translating Music Assistant into a language that it currently does not support, please see here https://music-assistant.io/help/lokalise/.

---

[![A project from the Open Home Foundation](https://www.openhomefoundation.org/badges/ohf-project.png)](https://www.openhomefoundation.org/)
