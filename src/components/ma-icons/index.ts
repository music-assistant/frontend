// Registry of all MA custom icons. To add a new icon:
//   1. Create `<kebab-name>.ts` and export a Component.
//   2. Add it to `registry` below.
//   3. Optionally add aliases.
import type { Component } from "vue";

import { HomepodMini } from "./homepod-mini";
import { Sonos } from "./sonos";
import { Mac } from "./mac";
import { AppleTv } from "./apple-tv";

/** Canonical name → component map. Names are stored in player configs. */
export const registry: Record<string, Component> = {
  "homepod-mini": HomepodMini,
  sonos: Sonos,
  mac: Mac,
  "apple-tv": AppleTv,
};

/**
 * Alternate / legacy names resolved to a canonical name. The target may be an
 * MA registry key or a Lucide kebab name (getLucideIcon falls through to Lucide
 * after alias resolution), so friendly suggestion labels that have no matching
 * Lucide export can still render a real icon.
 */
export const aliases: Record<string, string> = {
  homepod: "homepod-mini",
  "apple-homepod-mini": "homepod-mini",
  appletv: "apple-tv",
  // Descriptive suggestion labels with no direct Lucide export → closest icon.
  "speaker-loud": "volume-2",
  "bluetooth-speaker": "bluetooth",
  // Names Lucide renamed/removed in newer versions.
  "laptop-2": "laptop-minimal",
  tree: "tree-pine",
  home: "house",
};
