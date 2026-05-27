import type { Component } from "vue";
import * as MaIcons from "@/components/ma-icons";
import * as LucideIcons from "@lucide/vue";

/** All custom MA icon names, shown first in search results. */
export const MA_ICON_NAMES: readonly string[] = Object.keys(
  MaIcons.registry,
).sort();

function kebabToPascal(name: string): string {
  return name.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase());
}

function pascalToKebab(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

type LucideModule = Record<string, unknown>;
const lucideModule = LucideIcons as unknown as LucideModule;

/** Returns the Vue component for a Lucide or MA kebab-case icon name, or undefined for MDI names. */
export function getLucideIcon(
  name: string | null | undefined,
): Component | undefined {
  if (!name || name.startsWith("mdi-")) return undefined;
  // Resolve alias first, then look up in registry
  const canonical = MaIcons.aliases[name] ?? name;
  if (MaIcons.registry[canonical]) return MaIcons.registry[canonical];
  // Fall through to Lucide
  const comp = lucideModule[kebabToPascal(canonical)];
  return typeof comp === "function" ? (comp as Component) : undefined;
}

/** Returns true if the icon string is an MDI icon (starts with "mdi-"). */
export function isMdiIcon(name: string | null | undefined): boolean {
  return !!name?.startsWith("mdi-");
}

/** All Lucide icon names in kebab-case, sorted alphabetically. Awaits the async module. */
export async function getLucideIconNames(): Promise<readonly string[]> {
  return Object.keys(lucideModule)
    .filter((key) => {
      const val = lucideModule[key];
      return (
        typeof val === "function" &&
        /^[A-Z]/.test(key) && // icon exports are PascalCase
        !key.endsWith("Icon") && // skip *Icon suffix aliases
        !key.startsWith("Lucide") // skip Lucide* prefix aliases
      );
    })
    .map(pascalToKebab)
    .sort();
}

/** Curated suggestions shown by default in the icon picker. */
export const SUGGESTED_ICON_NAMES: readonly string[] = [
  // Custom MA device icons
  "homepod-mini",
  "sonos",
  "mac",
  "apple-tv",
  // Speaker / player types
  "speaker",
  "speaker-loud",
  "radio",
  "tv",
  "monitor",
  "laptop-2",
  "headphones",
  "bluetooth-speaker",
  "airplay",
  "cast",
  // Music / media
  "music",
  "music-2",
  "disc-3",
  "mic",
  "volume-2",
  // Room / area
  "sofa",
  "bed-double",
  "bath",
  "utensils",
  "tree",
  "car",
  "door-open",
  "sun",
  "flower-2",
  "briefcase",
  "home",
  "building",
];
