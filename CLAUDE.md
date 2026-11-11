# Music Assistant frontend

Vue 3 + TypeScript PWA for Music Assistant, built with Vite and pnpm. The
"Development Guidelines" in `README.md` are the source of truth; this file
summarizes them. Read the README section before writing code.

## Commands

- `pnpm dev`: dev server on http://localhost:3000, which asks for a Music Assistant server address
- `pnpm exec vue-tsc --noEmit`: type check
- `pnpm lint:check`: oxlint, eslint and prettier, the same as CI (`pnpm lint` fixes)
- `pnpm test:run`: vitest
- `pnpm build`: type check and production build

Run the type check, lint and tests before you consider a change done.

## UI

- New UI uses shadcn-vue components from `src/components/ui/`. Never add new Vuetify components.
- Use Tailwind utility classes first, including arbitrary values (`text-[44px]`) and variants (`max-md:`, `[&>.v-divider]:hidden`). Add a scoped `<style>` block only for what Tailwind cannot express, such as keyframes or `:deep()` into a child component. Avoid `style=""` except for dynamic values.
- Every Tailwind utility is `!important` (`src/styles/style.css`), so scoped CSS cannot override one. Override a utility with another utility; `cn()` (`src/lib/utils.ts`) drops the one it replaces.
- Use lucide icons (`@lucide/vue`) for new UI, not mdi.
- Match the spacing, icons and interaction patterns of equivalent existing views.
- Media detail pages share `src/components/details/` (`DetailHero`, row registry, `RowsEditor`). Compose from those instead of building page-specific copies.

## Code

- Keep components under 300 to 400 lines. Split them into focused sub-components when they grow.
- Type all props and emits, with no `any`. Use `interface` for object shapes and `type` for unions.
- Put stateful logic shared by components in `src/composables/`, and keep `<script setup>` lean.
- Put pure functions in `src/helpers/`, one file per concern, each with a colocated test (`src/helpers/foo.test.ts`).
- Show feedback on every user-triggered API call, with `toast.success(...)` on success and `toast.error(...)` on failure. Never swallow errors, and never use `console.error` in place of a toast.
- No magic numbers or strings. Move complex template expressions to computed properties. Clean up listeners, intervals and manual watchers.
- Use semantic HTML and `aria-*` labels on icon-only controls.

## Translations

- Add user-facing strings to `src/translations/en.json` only. Other locales are synced from Lokalise, never edited by hand.

## Server boundary

- The frontend ships in lockstep with `music-assistant/server`. Never gate on `schema_version` or add an older-server fallback. Raise `MIN_SERVER_SCHEMA_VERSION` in `src/plugins/api/index.ts` when the previous stable server would break.
- Logic every API client needs, such as volume, queue handling and filtering, belongs in the server, not in a frontend workaround.

## Pull requests

- Keep each PR small and single-purpose. Don't bump dependencies in a feature PR.
- Fill in `.github/pull_request_template.md` and tick exactly one "Types of changes" box, since it drives the label and the release notes.
- PRs that change UI need screenshots or a short video.
- More review precedents are in `.github/instructions/music-assistant-frontend-standards.instructions.md`.
- Always include before and after screenshots in a PR to the frontend repository
