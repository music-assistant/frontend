/**
 * The guided tour: a few stops that point out the main areas of the app.
 *
 * A stop is found on the page by the `data-tour` marker its element carries,
 * which is what lets one tour serve both layouts: the menu stop is the sidebar
 * on a desktop and the menu button in the bottom bar on a phone. A stop whose
 * element is not on screen is left out, so the tour only ever points at what
 * is there.
 */

export type TourStopId =
  | "menu"
  | "search"
  | "settings"
  | "profile"
  | "player_bar"
  | "player_select";

/** The stops in the order the tour walks them. */
export const TOUR_STOPS: readonly TourStopId[] = [
  "menu",
  "search",
  "settings",
  "profile",
  "player_bar",
  "player_select",
];

/** The attribute an element carries to be a stop's target. */
export const TOUR_TARGET_ATTRIBUTE = "data-tour";

/** Where the tour's card sits relative to the stop it describes. */
export type TourCardSide = "right" | "top";

/** A box on the screen, in viewport pixels. */
export interface TourFrame {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * The element a stop points at, or null when it is not on screen. The first
 * visible match wins, so a tablet that shows the sidebar next to the bottom
 * bar is walked along the sidebar.
 */
export function findTourTarget(
  id: TourStopId,
  root: ParentNode = document,
): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(
    `[${TOUR_TARGET_ATTRIBUTE}="${id}"]`,
  );
  for (const candidate of candidates) {
    if (isOnScreen(candidate)) return candidate;
  }
  return null;
}

/** The stops the page can show right now, in tour order. */
export function availableTourStops(root: ParentNode = document): TourStopId[] {
  return TOUR_STOPS.filter((id) => findTourTarget(id, root) !== null);
}

/**
 * Where the card goes: beside a stop in the sidebar, and above anything else,
 * which is all along the bottom of the screen.
 */
export function tourCardSide(target: Element): TourCardSide {
  return target.closest(SIDEBAR_SELECTOR) ? "right" : "top";
}

/** The box the spotlight draws around a stop: its rectangle plus a margin. */
export function spotlightFrame(
  rect: DOMRectReadOnly,
  margin: number,
): TourFrame {
  return {
    top: rect.top - margin,
    left: rect.left - margin,
    width: rect.width + 2 * margin,
    height: rect.height + 2 * margin,
  };
}

/** Whether two frames describe the same box. */
export function sameFrame(one: TourFrame, other: TourFrame): boolean {
  return (
    one.top === other.top &&
    one.left === other.left &&
    one.width === other.width &&
    one.height === other.height
  );
}

// the sidebar's root on a desktop; the mobile sheet carries the same slot
const SIDEBAR_SELECTOR = '[data-slot="sidebar"]';
// the sidebar as a phone shows it: a sheet that is closed while the tour runs,
// so nothing inside it can be pointed at, even while it is still sliding shut
const MOBILE_SHEET_SELECTOR = '[data-sidebar="sidebar"][data-mobile="true"]';

/**
 * Whether an element can be pointed at: laid out with a size of its own, and
 * not inside the mobile sidebar sheet.
 */
function isOnScreen(element: HTMLElement): boolean {
  if (element.closest(MOBILE_SHEET_SELECTOR)) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}
