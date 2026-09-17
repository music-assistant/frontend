// The card on the real popover: what the stub in TourOverlay.test.ts cannot
// show, which is how reka names the card and where it leaves focus.
import TourOverlay from "@/components/tour/TourOverlay.vue";
import { useTour } from "@/composables/useTour";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      navMenuEditMode: false,
      showPlayersMenu: false,
      showFullscreenPlayer: false,
    }),
  };
});

vi.mock("@/composables/useCommandCenter", () => ({
  useCommandCenter: () => ({ close: vi.fn() }),
}));

vi.mock("@/components/ui/sidebar", async () => {
  const { computed, ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useSidebar: () => ({
      isMobile: ref(false),
      state: computed(() => "expanded"),
      setOpen: vi.fn(),
      setOpenMobile: vi.fn(),
    }),
  };
});

/** A box on the screen, as the tests lay elements out with. */
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

// happy-dom lays nothing out, so an element is given its place by hand
function placeAt(element: Element, box: Box) {
  element.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
      toJSON: () => box,
    }) as DOMRect;
}

let wrapper: VueWrapper | undefined;

async function startTour() {
  wrapper = mount(TourOverlay, {
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  useTour().start();
  await flushPromises();
  return wrapper;
}

// the card is portalled to the body, so nothing in it is under the wrapper
function card() {
  return document.querySelector<HTMLElement>("[data-testid=tour-card]");
}

function nextButton() {
  return document.querySelector<HTMLElement>("[data-testid=tour-next]");
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  // two stops: the menu, and the profile menu the card hands focus to
  document.body.innerHTML =
    '<div data-slot="sidebar">' +
    '<button id="menu" data-tour="menu"></button>' +
    '<button id="profile" data-tour="profile"></button>' +
    "</div>";
  placeAt(document.getElementById("menu")!, {
    top: 0,
    left: 0,
    width: 256,
    height: 600,
  });
  placeAt(document.getElementById("profile")!, {
    top: 560,
    left: 8,
    width: 240,
    height: 48,
  });
});

afterEach(() => {
  // unmounted before the fixture goes, or the portal has nothing to leave
  wrapper?.unmount();
  wrapper = undefined;
  useTour().end();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("TourOverlay on the real popover", () => {
  it("is a dialog named after the stop and described by its text", async () => {
    await startTour();
    await vi.waitFor(() => expect(card()).not.toBeNull());

    // reka names a popover after its trigger, which this card has none of,
    // so the stop's title is put on the card itself
    expect(card()!.getAttribute("role")).toBe("dialog");
    expect(card()!.getAttribute("aria-label")).toBe("tour.stops.menu.title");
    const describedBy = card()!.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent?.trim()).toBe(
      "tour.stops.menu.description",
    );
  });

  it("leaves focus on the profile menu once the tour is done", async () => {
    await startTour();
    await vi.waitFor(() => expect(document.activeElement).toBe(nextButton()));

    nextButton()!.click();
    await flushPromises();
    nextButton()!.click();
    await flushPromises();

    // the closing card is unmounted, and focus with it, unless it is put back
    // somewhere first
    await vi.waitFor(() => expect(card()).toBeNull());
    expect(document.activeElement).toBe(document.getElementById("profile"));
  });
});
