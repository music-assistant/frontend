// The colours of an icon, read from the text of an SVG, never drawn or run.

// a fill, a gradient stop or a stroke, as an attribute or in a style; what an
// rgb() holds is bounded, so an unclosed one cannot make every match scan the rest
const COLOR_PATTERN =
  /(?:fill|stop-color|stroke)\s*(?:=\s*["']|:)\s*(#[0-9a-f]{3,8}\b|rgba?\([\d\s.,%/]{1,40}\)|white\b|black\b)/gi;
const NAMED_COLORS: Readonly<Record<string, Rgb>> = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
};
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
 * The main colour of an icon as `#rrggbb`: the colour an SVG states most often
 * (as a fill, a gradient stop or a stroke) that is neither near white, near
 * black nor grey. Null for an image that is not an SVG, for input that cannot be
 * read, and when the SVG states no such colour.
 *
 * @param dataUri - The icon, as a data URI.
 */
export function getIconColor(dataUri?: string | null): string | null {
  const svg = readSvg(dataUri);
  if (!svg) return null;
  const counts = new Map<string, number>();
  for (const color of readColors(svg)) {
    if (!isVivid(color)) continue;
    const hex = toHex(color);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [hex, count] of counts) {
    if (!best || count > counts.get(best)!) best = hex;
  }
  return best;
}

/**
 * Whether an icon is drawn in white only, so it disappears on a white
 * background: an SVG that states colours (fills, gradient stops, strokes), all
 * of them near white. False for an SVG that states none, for an image that is
 * not an SVG, and for input that cannot be read.
 *
 * @param dataUri - The icon, as a data URI.
 */
export function isDrawnInWhite(dataUri?: string | null): boolean {
  const svg = readSvg(dataUri);
  if (!svg) return false;
  const colors = readColors(svg);
  return (
    colors.length > 0 &&
    colors.every((color) => lightness(color) > MAX_LIGHTNESS)
  );
}

function readColors(svg: string): Rgb[] {
  return [...svg.matchAll(COLOR_PATTERN)].flatMap(([, value]) => {
    const color = parseColor(value);
    return color ? [color] : [];
  });
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
  const named = NAMED_COLORS[value.toLowerCase()];
  if (named) return named;
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

function isVivid(color: Rgb): boolean {
  const max = Math.max(color.r, color.g, color.b) / 255;
  const min = Math.min(color.r, color.g, color.b) / 255;
  const light = lightness(color);
  if (light > MAX_LIGHTNESS || light < MIN_LIGHTNESS) return false;
  const saturation =
    max === min ? 0 : (max - min) / (1 - Math.abs(2 * light - 1));
  return saturation >= MIN_SATURATION;
}

function lightness({ r, g, b }: Rgb): number {
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
