# Vendored: music-assistant/shared-icons

`manifest.json` (the icon-set contract: canonical ids + fallback) and `meta.json`
(display names, categories, picker keywords) are copied from
https://github.com/music-assistant/shared-icons.

To update: copy both files from the desired release tag of that repo. When a new
id is added there, also map it to a component in `src/helpers/icon.ts` (Lucide
name override if it differs from the id) or `src/components/ma-icons/` (custom
artwork) — `tests/helpers/icon.test.ts` fails if any manifest id doesn't resolve.
