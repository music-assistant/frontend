import * as MaIcons from "@/components/ma-icons";
import manifest from "@/vendor/shared-icons/manifest.json";
import meta from "@/vendor/shared-icons/meta.json";
import { BookOpen, Disc3, PartyPopper, Sunrise } from "@lucide/vue";
import type { Component } from "vue";

export const PLAYER_ICON_IDS: readonly string[] = manifest.icons;

export const PLAYER_ICON_FALLBACK: string = manifest.fallback;

export interface PlayerIconOption {
  id: string;
  name: string;
  category: string;
  keywords: readonly string[];
}

interface IconMeta {
  name: string;
  category: string;
  keywords: string[];
}
const iconMeta = (meta as { icons: Record<string, IconMeta> }).icons;

export const PLAYER_ICON_OPTIONS: readonly PlayerIconOption[] =
  manifest.icons.map((id) => ({
    id,
    name: iconMeta[id]?.name ?? id,
    category: iconMeta[id]?.category ?? "player",
    keywords: iconMeta[id]?.keywords ?? [],
  }));

const APP_ICON_COMPONENTS: Record<string, Component> = {
  // App icons outside the player icon set (AI-radio show presets).
  sunrise: Sunrise,
  "disc-3": Disc3,
  "book-open": BookOpen,
  "party-popper": PartyPopper,
};

export function getLucideIcon(
  name: string | null | undefined,
): Component | undefined {
  if (!name) return undefined;
  return MaIcons.registry[name] ?? APP_ICON_COMPONENTS[name];
}
