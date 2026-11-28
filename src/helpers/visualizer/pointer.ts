/**
 * Whether the primary pointer can hover (a desktop mouse/trackpad). Touch
 * devices get tap-driven preview surfaces instead of hover previews.
 */
export function isHoverCapablePointer(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
}
