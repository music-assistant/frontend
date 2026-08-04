// Registry of all MA custom icons. To add a new icon:
//   1. Create `<kebab-name>.ts` and export a Component.
//   2. Add it to `registry` below.
// Custom icon artwork is owned by the shared icon set
// (https://github.com/music-assistant/shared-icons) — these components mirror
// its `icons/*.svg`; update them from there, repo-first.
import type { Component } from "vue";

import { HomepodMini } from "./homepod-mini";
import { Sonos } from "./sonos";
import { Mac } from "./mac";
import { AppleTv } from "./apple-tv";
import { GoogleNest } from "./google-nest";
import { VoicePe } from "./voice-pe";
import { Wiim } from "./wiim";
import { Speakers } from "./speakers";
import { Soundbar } from "./soundbar";

export { Speakers };

/** Canonical id → component map. Ids are stored in player configs. */
export const registry: Record<string, Component> = {
  "homepod-mini": HomepodMini,
  sonos: Sonos,
  mac: Mac,
  "apple-tv": AppleTv,
  "google-nest": GoogleNest,
  "voice-pe": VoicePe,
  wiim: Wiim,
  speakers: Speakers,
  soundbar: Soundbar,
};
