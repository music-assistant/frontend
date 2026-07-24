// Frontend-only presets. The server only receives the raw strength value.
export interface CrossfeedPreset {
  id: "low" | "medium" | "high";
  strength: number;
}

export const CROSSFEED_PRESETS: CrossfeedPreset[] = [
  { id: "low", strength: 0.2 },
  { id: "medium", strength: 0.35 },
  { id: "high", strength: 0.5 },
];
