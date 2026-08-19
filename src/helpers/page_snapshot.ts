/**
 * A still copy of the page, pinned on top of the real one.
 *
 * The back swipe needs the view being left to stay on screen while the view
 * behind it renders underneath, and the router has already thrown that view
 * away by then - so a clone stands in for it until the gesture is over.
 */
export interface PageSnapshot {
  el: HTMLElement;
  place: (offsetX: number, ms?: number) => void;
  remove: () => void;
}

const SNAPSHOT_Z_INDEX = "3";
const EDGE_SHADOW = "-8px 0 24px rgb(0 0 0 / 0.18)";

export function capturePageSnapshot(source: HTMLElement): PageSnapshot {
  const rect = source.getBoundingClientRect();
  const el = source.cloneNode(true) as HTMLElement;

  el.setAttribute("aria-hidden", "true");
  el.setAttribute("inert", "");
  Object.assign(el.style, {
    position: "fixed",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    zIndex: SNAPSHOT_Z_INDEX,
    pointerEvents: "none",
    willChange: "transform",
    backgroundColor: inheritedBackground(source),
    boxShadow: EDGE_SHADOW,
  });

  document.body.appendChild(el);
  copyScrollOffsets(source, el);

  return {
    el,
    place: (offsetX: number, ms?: number) => {
      el.style.transition = ms
        ? `transform ${ms}ms cubic-bezier(0.32, 0.72, 0, 1)`
        : "none";
      el.style.transform = `translate3d(${offsetX}px, 0, 0)`;
    },
    remove: () => el.remove(),
  };
}

function copyScrollOffsets(source: Element, clone: Element) {
  const from = [source, ...source.querySelectorAll("*")];
  const to = [clone, ...clone.querySelectorAll("*")];
  for (let i = 0; i < from.length && i < to.length; i++) {
    if (from[i].scrollTop) to[i].scrollTop = from[i].scrollTop;
    if (from[i].scrollLeft) to[i].scrollLeft = from[i].scrollLeft;
  }
}

function inheritedBackground(source: Element): string {
  for (
    let el: Element | null = source;
    el && el !== document.documentElement;
    el = el.parentElement
  ) {
    const { backgroundColor } = getComputedStyle(el);
    if (backgroundColor && !isTransparent(backgroundColor)) {
      return backgroundColor;
    }
  }
  return "var(--background)";
}

function isTransparent(color: string): boolean {
  if (color === "transparent") return true;
  const alpha = color.match(/^rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/)?.[1];
  return alpha !== undefined && Number(alpha) === 0;
}
