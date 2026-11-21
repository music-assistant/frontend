// Sentinel so the picker's "use previewed" entry can't collide with a preset name.
export const USE_PREVIEWED_VALUE = "__use_previewed__";

/** The preset a fixed-preset picker value stands for; "" when there is none. */
export function resolveFixedPreset(
  value: string,
  previewed: string | null,
): string {
  return value === USE_PREVIEWED_VALUE ? (previewed ?? "") : value;
}
