/**
 * Drag the playing song into the timeline. The card follows the finger on a
 * spring, the songs slide apart where it will land, and on release it
 * settles into the gap with a small bounce. Same feel as the Move Assistant
 * reorder (follow k .2 / d .68, settle k .24 / d .62, lift 1.035, tilt ±3°).
 *
 * The card never moves in the DOM while dragging (that would drop pointer
 * capture); it floats with a transform and the new order is applied once,
 * after it lands.
 */

/** The bounce used for things sliding into place. */
export const RUBBER = "cubic-bezier(.34,1.46,.64,1)";

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** A tiny tick on phones that support it (Android); others ignore it. */
export function buzz(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration is a nicety only.
  }
}

/** The small squash a card makes as it lands. */
export function landingSquash(element: HTMLElement | null | undefined): void {
  if (!element || prefersReducedMotion() || !element.animate) return;
  element.animate(
    [
      { transform: "scale(1.02,.95)" },
      { transform: "scale(.995,1.012)" },
      { transform: "none" },
    ],
    { duration: 340, easing: "ease-out" },
  );
}

/**
 * Moves elements from where they were to where `mutate` puts them, with the
 * same bounce. `mutate` may be async (e.g. wait for Vue to re-render).
 */
export async function flip(
  elements: () => HTMLElement[],
  mutate: () => Promise<void> | void,
): Promise<void> {
  if (prefersReducedMotion()) {
    await mutate();
    return;
  }
  const before = new Map(
    elements().map((element) => [element, element.getBoundingClientRect().top]),
  );
  await mutate();
  for (const element of elements()) {
    const top = before.get(element);
    if (top === undefined || !element.animate) continue;
    const delta = top - element.getBoundingClientRect().top;
    if (Math.abs(delta) < 1) continue;
    element.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
      { duration: 440, easing: RUBBER },
    );
  }
}

function scrollParent(element: HTMLElement): HTMLElement {
  for (
    let parent = element.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    const overflow = getComputedStyle(parent).overflowY;
    if (
      (overflow === "auto" || overflow === "scroll") &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/** A press that moves less than this is a tap, not a drag. */
const TAP_DISTANCE = 12;

export interface TimelineDragOptions {
  /** The list holding the timeline's songs (and the card once placed). */
  list: HTMLElement;
  /** The card being dragged; it also holds the pointer capture. */
  card: HTMLElement;
  /** The timeline's song rows in order, not including the card. */
  entries: HTMLElement[];
  /** The gap the card sits in now: how many songs are above it. */
  slot: number;
  /**
   * For a song that isn't placed yet: the dashed gaps it can go in (top to
   * bottom) and the song cards between them. Instead of the songs sliding
   * apart, the gap it's over grows to the card's size (onTarget tells the
   * page which) and pushes the songs below it down; the card lands in it.
   */
  gaps?: { slots: HTMLElement[]; songs: HTMLElement[] };
  /**
   * The gap the card would land in right now, once it's really being dragged
   * (not a tap). `cancelling` is true while it's pulled aside to call it off,
   * when it would go back where it was instead.
   */
  onTarget?: (slot: number, cancelling: boolean) => void;
  /**
   * The card has settled in `slot`; `moved` is false for a tap or a tiny
   * nudge, `cancelled` true when the drag was called off (Escape, or pulled
   * aside) and the card went back. Apply it and resolve once the page shows
   * it: the floating styles are cleared after that, so nothing jumps.
   */
  onDrop: (
    slot: number,
    moved: boolean,
    cancelled: boolean,
  ) => Promise<void> | void;
  /** A press that didn't move. Without it a tap lands like a tiny drag. */
  onTap?: () => void;
}

export function startTimelineDrag(
  event: PointerEvent,
  options: TimelineDragOptions,
): void {
  const { list, card, entries, gaps } = options;
  // One finger at a time, and not while the last drop is still settling.
  if (event.button !== 0 || !event.isPrimary || card.dataset.dragging) return;
  event.preventDefault();
  const pointerId = event.pointerId;
  const motion = !prefersReducedMotion();
  try {
    card.setPointerCapture(pointerId);
  } catch {
    // Without capture the window listeners below still follow the pointer.
  }

  const scroller = scrollParent(list);
  const previousPosition = list.style.position;
  // Offsets are measured from the list.
  list.style.position = "relative";
  const gap = parseFloat(getComputedStyle(list).rowGap) || 8;
  const height = card.offsetHeight;
  const step = height + gap;
  const tops = entries.map((row) => row.offsetTop);
  const heights = entries.map((row) => row.offsetHeight);
  const listTop = () => list.getBoundingClientRect().top;
  const width = list.getBoundingClientRect().width;
  const startTop = card.getBoundingClientRect().top;
  // The card's resting top, measured from the list (negative above it).
  const originOffset = startTop - listTop();
  const grab = event.clientY - startTop;
  const startX = event.clientX;
  const from = options.slot;
  // Growing gaps: where each gap starts and each song's middle, with every
  // gap still small, and how much a gap grows to fit the card.
  const offsetFromList = (element: HTMLElement) =>
    element.getBoundingClientRect().top - listTop();
  const gapTops = gaps?.slots.map(offsetFromList) ?? [];
  const songMiddles =
    gaps?.songs.map((song) => offsetFromList(song) + song.offsetHeight / 2) ??
    [];
  const growth = gaps ? height - (gaps.slots[0]?.offsetHeight ?? 0) : 0;

  let lastY = event.clientY;
  let lastX = event.clientX;
  let y = startTop;
  let vy = 0;
  let x = 0;
  let vx = 0;
  let lift = 1;
  let vl = 0;
  let to = from;
  let travel = 0;
  let cancelling = false;
  let settling = false;
  let landed = false;
  let raf = 0;
  let finalTop = originOffset;
  // What onTarget last heard, so it's told only of changes.
  let reportedTo: number | null = null;
  let reportedCancelling = false;

  card.dataset.dragging = "true";
  card.style.transition = "none";
  card.style.position = "relative";
  card.style.zIndex = "20";
  for (const row of entries) {
    row.style.transition = motion ? `transform .44s ${RUBBER}` : "none";
  }
  buzz(8);

  // How many songs sit above the card's centre (in the original layout).
  const targetSlot = (): number => {
    const center = lastY - grab + height / 2 - listTop();
    let slot = 0;
    if (gaps) {
      // The grown gap pushes the songs below it down. Counting them where
      // they are now keeps the target steady at the edges.
      songMiddles.forEach((middle, index) => {
        if (center > middle + (index >= to ? growth : 0)) slot++;
      });
      return slot;
    }
    tops.forEach((top, index) => {
      if (center > top + heights[index] / 2) slot++;
    });
    return slot;
  };

  const shiftEntries = () => {
    // With growing gaps the page moves the songs, not this.
    if (gaps) return;
    entries.forEach((row, index) => {
      let shift = 0;
      if (from < to && index >= from && index < to) shift = -step;
      else if (from > to && index >= to && index < from) shift = step;
      row.style.transform = shift ? `translateY(${shift}px)` : "";
    });
  };

  // Tells onTarget where the card would land, once it's clearly a drag.
  const report = () => {
    if (travel <= TAP_DISTANCE) return;
    if (to === reportedTo && cancelling === reportedCancelling) return;
    reportedTo = to;
    reportedCancelling = cancelling;
    options.onTarget?.(to, cancelling);
  };

  const update = () => {
    const bounds = list.getBoundingClientRect();
    const pulledAside =
      Math.abs(lastX - startX) > Math.max(80, width * 0.3) ||
      lastX < bounds.left - 24 ||
      lastX > bounds.right + 24;
    if (pulledAside !== cancelling) {
      cancelling = pulledAside;
      buzz(pulledAside ? 10 : 4);
    }
    const next = cancelling ? from : targetSlot();
    if (next !== to) {
      to = next;
      shiftEntries();
      if (!cancelling) buzz(4);
    }
    report();
  };

  // Where the card's top ends up (from the list) once it lands in `to`.
  const landingTop = (): number => {
    // Into the grown gap, whose top stays put once the others are small.
    if (gaps) return cancelling ? originOffset : (gapTops[to] ?? originOffset);
    if (to === from) return originOffset;
    const firstTop = from === 0 ? originOffset : tops[0];
    let top = firstTop;
    for (let index = 0; index < to; index++) top += heights[index] + gap;
    return top;
  };

  const paint = () => {
    const stretch = motion ? Math.min(Math.abs(vy) / 40, 1) : 0;
    const tilt = motion && !settling ? Math.max(-3, Math.min(3, vx * 0.6)) : 0;
    const offsetY = y - (listTop() + originOffset);
    card.style.transform =
      `translate(${x.toFixed(2)}px,${offsetY.toFixed(2)}px) ` +
      `rotate(${tilt.toFixed(2)}deg) ` +
      `scale(${(lift * (1 - 0.04 * stretch)).toFixed(4)},${(lift * (1 + 0.06 * stretch)).toFixed(4)})`;
  };

  const frame = () => {
    raf = requestAnimationFrame(frame);
    const dx = lastX - startX;
    const targetY = settling ? listTop() + finalTop : lastY - grab;
    const targetX = settling
      ? 0
      : cancelling
        ? dx * 0.9
        : Math.max(-22, Math.min(22, dx * 0.22));
    const targetLift = settling ? 1 : cancelling ? 0.97 : 1.035;
    if (!motion) {
      y = targetY;
      x = targetX;
      lift = 1;
      paint();
      if (settling) void land();
      return;
    }
    const k = settling ? 0.24 : 0.2;
    const damping = settling ? 0.62 : 0.68;
    vy = (vy + (targetY - y) * k) * damping;
    y += vy;
    vx = (vx + (targetX - x) * 0.16) * 0.7;
    x += vx;
    vl = (vl + (targetLift - lift) * 0.22) * 0.6;
    lift += vl;
    paint();
    if (
      settling &&
      Math.abs(vy) < 0.15 &&
      Math.abs(targetY - y) < 0.5 &&
      Math.abs(x) < 0.5 &&
      Math.abs(lift - 1) < 0.003
    ) {
      void land();
    }
  };

  // Near the top or bottom of the scroll area the list scrolls along.
  // The edge zone clears the sticky timer and Lock in bar.
  const scrollTimer = setInterval(() => {
    if (settling) return;
    const bounds = scroller.getBoundingClientRect();
    const edge = 96;
    const delta =
      lastY < bounds.top + edge ? -10 : lastY > bounds.bottom - edge ? 10 : 0;
    if (delta) {
      scroller.scrollTop += delta;
      update();
    }
  }, 30);

  function clearFloatingStyles() {
    for (const row of entries) {
      row.style.transition = "none";
      row.style.transform = "";
    }
    card.style.transition = "";
    card.style.transform = "";
    card.style.position = "";
    card.style.zIndex = "";
    delete card.dataset.dragging;
    list.style.position = previousPosition;
  }

  async function land() {
    if (landed) return;
    landed = true;
    cancelAnimationFrame(raf);
    clearInterval(scrollTimer);
    await options.onDrop(to, travel > TAP_DISTANCE, cancelling);
    clearFloatingStyles();
  }

  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== pointerId) return;
    if (moveEvent.pointerType === "mouse" && moveEvent.buttons === 0) {
      release();
      return;
    }
    lastY = moveEvent.clientY;
    lastX = moveEvent.clientX;
    travel = Math.max(
      travel,
      Math.hypot(lastX - startX, lastY - startTop - grab),
    );
    update();
  };
  const up = (upEvent: PointerEvent) => {
    if (upEvent.pointerId === pointerId) release();
  };
  const cancelOnEscape = (keyEvent: KeyboardEvent) => {
    if (keyEvent.key !== "Escape") return;
    cancelling = true;
    release();
  };

  function release() {
    if (settling) return;
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", up, true);
    window.removeEventListener("keydown", cancelOnEscape, true);
    window.removeEventListener("blur", release);
    card.removeEventListener("lostpointercapture", release);
    clearInterval(scrollTimer);
    if (options.onTap && !cancelling && travel <= TAP_DISTANCE) {
      // A tap: drop the lift straight away rather than settling.
      settling = true;
      landed = true;
      cancelAnimationFrame(raf);
      clearFloatingStyles();
      options.onTap();
      return;
    }
    if (cancelling && to !== from) {
      to = from;
      shiftEntries();
    }
    report();
    finalTop = landingTop();
    settling = true;
    buzz(6);
    // Land even if the spring never quite comes to rest.
    setTimeout(() => void land(), 800);
  }

  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", up, true);
  window.addEventListener("keydown", cancelOnEscape, true);
  window.addEventListener("blur", release);
  card.addEventListener("lostpointercapture", release);
  raf = requestAnimationFrame(frame);
  paint();
}
