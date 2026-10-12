# Music Assistant frontend

Follow the "Development Guidelines" in `README.md` and the review precedents in
`.github/instructions/music-assistant-frontend-standards.instructions.md`.

## Styling

- Tailwind utility classes first. Reach for a scoped `<style>` block only for
  what utilities cannot express (keyframes, `:deep()` into a child component).
  Arbitrary values (`text-[44px]`, `shadow-[0_8px_24px_rgba(0,0,0,0.5)]`) and
  variants (`max-md:`, `[&>.v-divider]:hidden`) count as Tailwind.
- Every utility is `!important` (`src/styles/style.css`), so scoped CSS cannot
  override one. Override a utility with another utility; `cn()` drops the loser.
- New UI uses shadcn-vue (`src/components/ui/`), never new Vuetify components.
