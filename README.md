# Music Assistant frontend (Vue PWA)

The Music Assistant frontend/panel is developed in Vue, development instructions below.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
    1) Run `Extensions: Show Built-in Extensions` from VSCode's command palette
    2) Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
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

# Translation Management

We use Lokalise to manage the translation files for the Music Assistant frontend

[<img src="https://github.com/lokalise/i18n-ally/raw/screenshots/lokalise-logo.png?raw=true" alt="Lokalise logo" width="275px">](https://lokalise.com)

### Contributing

If you wish to assist in translating Music Assistant into a language that it currently does not support, please see here https://music-assistant.io/help/lokalise/.
