// The main colour of an icon, read from the text of an SVG, never drawn or run.

/** The colour for an icon without a main colour of its own. */
export const NEUTRAL_ICON_COLOR = "#64748b";

// a fill or a gradient stop, as an attribute or in a style
const FILL_PATTERN =
  /(?:fill|stop-color)\s*(?:=\s*["']|:)\s*(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/gi;
const SVG_DATA_URI = /^data:image\/svg\+xml((?:;[^,;]*)*),(.*)$/is;
// lightness above or below which a colour reads as white or black, and the
// saturation below which it reads as grey
const MAX_LIGHTNESS = 0.92;
const MIN_LIGHTNESS = 0.1;
const MIN_SATURATION = 0.15;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * The main colour of an icon as `#rrggbb`: the most used fill of an SVG that is
 * neither near white, near black nor grey. Null for an image that is not an
 * SVG, for input that cannot be read, and when the SVG has no such fill.
 *
 * @param dataUri - The icon, as a data URI.
 */
export function getIconColor(dataUri?: string | null): string | null {
  const svg = readSvg(dataUri);
  if (!svg) return null;
  const counts = new Map<string, number>();
  for (const [, value] of svg.matchAll(FILL_PATTERN)) {
    const color = parseColor(value);
    if (!color || !isVivid(color)) continue;
    const hex = toHex(color);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [hex, count] of counts) {
    if (!best || count > counts.get(best)!) best = hex;
  }
  return best;
}

function readSvg(dataUri?: string | null): string | null {
  const match = dataUri ? SVG_DATA_URI.exec(dataUri) : null;
  if (!match) return null;
  const [, params, data] = match;
  try {
    return params.toLowerCase().includes(";base64")
      ? atob(data)
      : decodeURIComponent(data);
  } catch {
    return null;
  }
}

function parseColor(value: string): Rgb | null {
  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (![3, 4, 6, 8].includes(hex.length)) return null;
    // #rgb and #rgba repeat each digit; an alpha is left out
    const digits =
      hex.length <= 4
        ? hex
            .slice(0, 3)
            .split("")
            .map((digit) => digit + digit)
        : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
    const [r, g, b] = digits.map((digit) => parseInt(digit, 16));
    return { r, g, b };
  }
  const channels = value
    .slice(value.indexOf("(") + 1, -1)
    .split(/[\s,/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number);
  if (
    channels.length !== 3 ||
    channels.some((channel) => !Number.isFinite(channel))
  )
    return null;
  const [r, g, b] = channels.map((channel) =>
    Math.round(Math.min(255, Math.max(0, channel))),
  );
  return { r, g, b };
}

function isVivid({ r, g, b }: Rgb): boolean {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  if (lightness > MAX_LIGHTNESS || lightness < MIN_LIGHTNESS) return false;
  const saturation =
    max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1));
  return saturation >= MIN_SATURATION;
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
