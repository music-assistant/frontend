/**
 * A still copy of a page, shown behind the live one while a back swipe
 * drags it aside.
 *
 * The swipe reveals the view it would return to before the router has
 * rendered it, so a clone captured when that view was last on screen stands
 * in for it until the navigation lands.
 */
export interface PagePreview {
  el: HTMLElement;
  mount: (container: HTMLElement) => void;
  place: (offsetX: number, ms?: number) => void;
  remove: () => void;
}

const CACHE_MAX = 4;
const cache = new Map<string, PagePreview>();

/**
 * Clones `surface` into an inert preview. The clone is not attached to
 * anything yet: `mount` slots it in underneath a live page, `place` slides
 * it sideways, and `remove` detaches it again.
 */
export function capturePagePreview(surface: HTMLElement): PagePreview {
  const el = surface.cloneNode(true) as HTMLElement;
  const scrollOffsets = recordScrollOffsets(surface);

  // Avoid duplicate IDs in the document while the preview is mounted.
  el.removeAttribute("id");
  el.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));

  el.setAttribute("aria-hidden", "true");
  el.setAttribute("inert", "");
  Object.assign(el.style, {
    margin: "0",
    pointerEvents: "none",
    willChange: "transform",
    backgroundColor: inheritedBackground(surface),
    // the live page sliding over the preview carries the edge shadow
    boxShadow: "none",
    // a capture can happen while the page is dragged or parked mid-swipe
    transform: "none",
    transition: "none",
  });

  return {
    el,
    mount: (container: HTMLElement) => {
      Object.assign(el.style, {
        position: "absolute",
        inset: "0",
        zIndex: "0",
      });
      container.appendChild(el);
      // scroll positions cannot take hold while the clone is detached
      applyScrollOffsets(el, scrollOffsets);
    },
    place: (offsetX: number, ms?: number) => {
      el.style.transition = ms
        ? `transform ${ms}ms cubic-bezier(0.32, 0.72, 0, 1)`
        : "none";
      el.style.transform = `translate3d(${offsetX}px, 0, 0)`;
    },
    remove: () => el.remove(),
  };
}

/**
 * Keeps a preview for a later swipe back to the page named by `key`,
 * evicting the longest-stored one once the cache is full.
 */
export function storePagePreview(key: string, preview: PagePreview): void {
  cache.delete(key);
  cache.set(key, preview);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

/**
 * Hands over the preview stored under `key`, if any; the caller owns
 * mounting and removing it from here on.
 */
export function takePagePreview(key: string): PagePreview | undefined {
  const preview = cache.get(key);
  cache.delete(key);
  return preview;
}

/**
 * Drops every stored preview.
 */
export function clearPagePreviews(): void {
  cache.clear();
}

/** Scroll positions inside the page, by element index in document order. */
function recordScrollOffsets(source: Element): [number, number, number][] {
  const offsets: [number, number, number][] = [];
  [source, ...source.querySelectorAll("*")].forEach((node, index) => {
    if (node.scrollTop || node.scrollLeft) {
      offsets.push([index, node.scrollTop, node.scrollLeft]);
    }
  });
  return offsets;
}

/** Replays recorded scroll positions onto the matching clone elements. */
function applyScrollOffsets(
  clone: Element,
  offsets: [number, number, number][],
) {
  const nodes = [clone, ...clone.querySelectorAll("*")];
  for (const [index, top, left] of offsets) {
    const node = nodes[index];
    if (!node) continue;
    if (top) node.scrollTop = top;
    if (left) node.scrollLeft = left;
  }
}

/** The first painted background behind the page, so the clone reads whole. */
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

/** Whether a computed color paints nothing at all. */
function isTransparent(color: string): boolean {
  if (color === "transparent") return true;
  const alpha = color.match(/^rgba?\([^)]*[,/]\s*([\d.]+)\s*\)$/)?.[1];
  return alpha !== undefined && Number(alpha) === 0;
}
