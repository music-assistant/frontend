/**
 * Colour shown behind the mobile status bar.
 *
 * iOS Safari samples the `html` background, Android Chrome reads the
 * theme-color meta, so both are kept in sync.
 */

let themeColor = "";
let overrideColor: string | undefined;

/** Sets the base colour that follows the active theme. */
export function setStatusBarThemeColor(color: string): void {
  themeColor = color;
  applyStatusBarColor();
}

/** Overrides the colour for one screen. Pass undefined to drop back to the theme colour. */
export function setStatusBarColorOverride(color: string | undefined): void {
  overrideColor = color;
  applyStatusBarColor();
}

function applyStatusBarColor(): void {
  const html = document.documentElement;
  if (overrideColor) html.style.backgroundColor = overrideColor;
  else html.style.removeProperty("background-color");

  const color = overrideColor ?? themeColor;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (meta && color) meta.content = color;
}
