import * as MaIcons from "@/components/ma-icons";
import manifest from "@/vendor/shared-icons/manifest.json";
import meta from "@/vendor/shared-icons/meta.json";
import {
  Airplay,
  Bath,
  BedDouble,
  Bluetooth,
  BookOpen,
  Briefcase,
  Building,
  Car,
  Cast,
  Disc3,
  DoorOpen,
  Flower2,
  Headphones,
  House,
  LaptopMinimal,
  Mic,
  Monitor,
  Music,
  PartyPopper,
  Radio,
  Smartphone,
  Sofa,
  Speaker,
  Sun,
  Sunrise,
  Tablet,
  Toilet,
  TreePine,
  Tv,
  Utensils,
  Volume2,
} from "@lucide/vue";
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

const LUCIDE_COMPONENTS: Record<string, Component> = {
  speaker: Speaker,
  radio: Radio,
  tv: Tv,
  monitor: Monitor,
  laptop: LaptopMinimal,
  smartphone: Smartphone,
  tablet: Tablet,
  headphones: Headphones,
  bluetooth: Bluetooth,
  airplay: Airplay,
  cast: Cast,
  car: Car,
  music: Music,
  vinyl: Disc3,
  mic: Mic,
  volume: Volume2,
  "living-room": Sofa,
  bedroom: BedDouble,
  bathroom: Bath,
  toilet: Toilet,
  kitchen: Utensils,
  office: Briefcase,
  hallway: DoorOpen,
  garden: Flower2,
  outdoor: TreePine,
  sun: Sun,
  home: House,
  building: Building,
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
  return MaIcons.registry[name] ?? LUCIDE_COMPONENTS[name];
}
