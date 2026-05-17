/**
 * Regenerate src/helpers/mdi-icon-names.ts from @mdi/svg meta.json.
 * Run with: node scripts/gen-mdi-icon-names.mjs
 * Automatically runs after `npm install` via the postinstall hook.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const meta = JSON.parse(
  readFileSync(join(root, "node_modules/@mdi/svg/meta.json"), "utf8"),
);

const icons = meta
  .filter((icon) => !icon.deprecated)
  .map((icon) => {
    const keywords = [
      ...icon.tags.map((t) => t.toLowerCase().replace(/\s+\/\s+/g, " ")),
      ...icon.aliases,
    ];
    return keywords.length > 0 ? { name: icon.name, keywords } : { name: icon.name };
  });

const content =
  `// Auto-generated from @mdi/svg meta.json — do not edit manually.\n` +
  `// Regenerate with: node scripts/gen-mdi-icon-names.mjs\n` +
  `export interface MdiIconEntry {\n` +
  `  name: string;\n` +
  `  keywords?: readonly string[];\n` +
  `}\n` +
  `export const MDI_ICON_NAMES: readonly MdiIconEntry[] = ` +
  JSON.stringify(icons) +
  ` as const;\n`;

const out = join(root, "src/helpers/mdi-icon-names.ts");
writeFileSync(out, content);
console.log(`Written ${icons.length} icon entries to src/helpers/mdi-icon-names.ts`);
