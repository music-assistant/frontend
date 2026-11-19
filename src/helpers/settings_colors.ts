/** The colours of the icons on the settings pages, by name. */
export const SETTINGS_COLORS = {
  indigo: "rgb(99, 102, 241)",
  blue: "rgb(59, 130, 246)",
  cyan: "rgb(6, 182, 212)",
  green: "rgb(34, 197, 94)",
  purple: "rgb(168, 85, 247)",
  "deep-purple": "rgb(124, 58, 237)",
  pink: "rgb(236, 72, 153)",
  red: "rgb(239, 68, 68)",
  orange: "rgb(249, 115, 22)",
  teal: "rgb(20, 184, 166)",
  "grey-darken-1": "rgb(158, 158, 158)",
} as const;

export type SettingsColor = keyof typeof SETTINGS_COLORS;
