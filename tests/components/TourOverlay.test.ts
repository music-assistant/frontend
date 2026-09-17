import TourOverlay from "@/components/tour/TourOverlay.vue";
import { useTour } from "@/composables/useTour";
import { TOUR_STOPS } from "@/helpers/tour";
import { store as storeModule } from "@/plugins/store";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const { closeCommandCenter, sidebar } = vi.hoisted(() => ({
  closeCommandCenter: vi.fn(),
  // replaced with refs by the sidebar mock factory below
  sidebar: {
    isMobile: { value: false } as { value: boolean },
    collapsed: { value: false } as { value: boolean },
    setOpen: vi.fn(),
    setOpenMobile: vi.fn(),
  },
}));

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
  useCommandCenter: () => ({ close: closeCommandCenter }),
}));

vi.mock("@/components/ui/sidebar", async () => {
  const { computed, ref } = await vi.importActual<typeof import("vue")>("vue");
  sidebar.isMobile = ref(false);
  sidebar.collapsed = ref(false);
  return {
    useSidebar: () => ({
      isMobile: sidebar.isMobile,
      state: computed(() =>
        sidebar.collapsed.value ? "collapsed" : "expanded",
      ),
      setOpen: sidebar.setOpen,
      setOpenMobile: sidebar.setOpenMobile,
    }),
  };
});

// the reka popover is reka's to test; these stand in for it and record what
// the card asks of it
vi.mock("@/components/ui/popover", () => ({
  Popover: {
    name: "Popover",
    // typed like reka's, so the bare `modal` attribute reads as true
    props: { open: Boolean, modal: Boolean },
    emits: ["update:open"],
    template: "<div :data-modal='modal'><slot v-if='open' /></div>",
  },
  PopoverContent: {
    name: "PopoverContent",
    props: ["reference", "side", "align", "sideOffset", "collisionPadding"],
    emits: ["interactOutside", "openAutoFocus", "closeAutoFocus"],
    template: "<div><slot /></div>",
  },
}));

// the real store computes nothing of this; on the mock it is plain state
const store = storeModule as typeof storeModule & {
  navMenuEditMode: boolean;
  showPlayersMenu: boolean;
  showFullscreenPlayer: boolean;
};

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

const BOXES: Record<string, Box> = {
  menu: { top: 60, left: 0, width: 256, height: 500 },
  search: { top: 100, left: 8, width: 240, height: 32 },
  settings: { top: 400, left: 8, width: 240, height: 32 },
  profile: { top: 560, left: 8, width: 240, height: 48 },
  player_bar: { top: 620, left: 0, width: 1200, height: 80 },
  player_select: { top: 620, left: 1100, width: 96, height: 80 },
};

/**
 * Lay a desktop out: the sidebar's stops in the sidebar, the rest along the
 * bottom, every one of them a button so focus can land on it.
 */
function layOutDesktop(stops: readonly string[] = TOUR_STOPS) {
  const inSidebar = ["menu", "search", "settings", "profile"];
  const stop = (id: string) => `<button id="${id}" data-tour="${id}"></button>`;
  document.body.innerHTML =
    '<div data-slot="sidebar">' +
    stops
      .filter((id) => inSidebar.includes(id))
      .map(stop)
      .join("") +
    "</div>" +
    stops
      .filter((id) => !inSidebar.includes(id))
      .map(stop)
      .join("");
  for (const id of stops) placeAt(document.getElementById(id)!, BOXES[id]);
}

// the spotlight is measured on animation frames, which the tests run by hand;
// a cancelled frame is taken off the list like the browser would
const frames = new Map<number, FrameRequestCallback>();
let lastFrameId = 0;
function runFrame() {
  const [id, callback] = frames.entries().next().value ?? [];
  if (id === undefined) return;
  frames.delete(id);
  callback?.(performance.now());
}

let wrapper: VueWrapper | undefined;

function mountOverlay() {
  wrapper = mount(TourOverlay, {
    attachTo: document.body,
    global: {
      mocks: {
        $t: (key: string, params?: Record<string, unknown>) =>
          params?.current != null
            ? `${params.current} of ${params.total}`
            : key,
      },
    },
  });
  return wrapper;
}

async function startTour() {
  const overlay = mountOverlay();
  useTour().start();
  await flushPromises();
  return overlay;
}

function card() {
  return wrapper!.findComponent({ name: "PopoverContent" });
}

function spotlight() {
  return document.querySelector<HTMLElement>("[data-testid=tour-spotlight]");
}

function title() {
  return wrapper!.find("[data-testid=tour-title]").text();
}

enableAutoUnmount(afterEach);

beforeEach(() => {
  frames.clear();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    lastFrameId += 1;
    frames.set(lastFrameId, callback);
    return lastFrameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  sidebar.isMobile.value = false;
  sidebar.collapsed.value = false;
  sidebar.setOpen.mockReset();
  sidebar.setOpenMobile.mockReset();
  closeCommandCenter.mockReset();
  store.navMenuEditMode = false;
  store.showPlayersMenu = false;
  store.showFullscreenPlayer = false;
  layOutDesktop();
});

afterEach(() => {
  useTour().end();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("TourOverlay", () => {
  it("shows nothing until the tour is started", () => {
    mountOverlay();

    expect(card().exists()).toBe(false);
    expect(spotlight()).toBeNull();
  });

  it("walks the stops in order and ends on Done", async () => {
    const overlay = await startTour();

    expect(title()).toBe("tour.stops.menu.title");
    expect(overlay.find("[data-testid=tour-counter]").text()).toBe("1 of 6");
    expect(overlay.find("[data-testid=tour-next]").text()).toBe("tour.next");
    // nothing to go back to yet
    expect(
      overlay.find("[data-testid=tour-back]").attributes("disabled"),
    ).toBeDefined();

    for (const id of TOUR_STOPS.slice(1)) {
      await overlay.find("[data-testid=tour-next]").trigger("click");
      expect(title()).toBe(`tour.stops.${id}.title`);
    }
    expect(overlay.find("[data-testid=tour-counter]").text()).toBe("6 of 6");
    expect(overlay.find("[data-testid=tour-next]").text()).toBe("done");

    await overlay.find("[data-testid=tour-next]").trigger("click");
    await flushPromises();

    expect(useTour().active.value).toBe(false);
    expect(card().exists()).toBe(false);
    expect(spotlight()).toBeNull();
    // and nothing is left measuring a stop that is no longer shown
    expect(frames.size).toBe(0);
  });

  it("goes back a stop, and moves focus off Back on the first stop", async () => {
    const overlay = await startTour();
    await overlay.find("[data-testid=tour-next]").trigger("click");
    expect(title()).toBe("tour.stops.search.title");

    const back = overlay.find("[data-testid=tour-back]");
    (back.element as HTMLElement).focus();
    await back.trigger("click");

    expect(title()).toBe("tour.stops.menu.title");
    expect(back.attributes("disabled")).toBeDefined();
    expect(document.activeElement).toBe(
      overlay.find("[data-testid=tour-next]").element,
    );
  });

  it("moves between stops on the arrow keys", async () => {
    await startTour();

    await card().trigger("keydown", { key: "ArrowRight" });
    expect(title()).toBe("tour.stops.search.title");

    await card().trigger("keydown", { key: "ArrowLeft" });
    expect(title()).toBe("tour.stops.menu.title");
  });

  it("leaves a modified arrow to the browser", async () => {
    await startTour();

    // Alt+Left goes back a page; the tour has no business moving as well
    await card().trigger("keydown", { key: "ArrowRight", altKey: true });
    await card().trigger("keydown", { key: "ArrowRight", metaKey: true });
    expect(title()).toBe("tour.stops.menu.title");
  });

  it("anchors the card to the stop, beside the sidebar and above the bar", async () => {
    await startTour();

    expect(card().props("reference")).toBe(document.getElementById("menu"));
    expect(card().props("side")).toBe("right");

    for (let step = 0; step < 4; step += 1) {
      await wrapper!.find("[data-testid=tour-next]").trigger("click");
    }
    expect(title()).toBe("tour.stops.player_bar.title");
    expect(card().props("reference")).toBe(
      document.getElementById("player_bar"),
    );
    expect(card().props("side")).toBe("top");
  });

  it("holds the screen for itself", async () => {
    await startTour();

    // the page behind the card is not for clicking while the tour runs
    expect(
      wrapper!.findComponent({ name: "Popover" }).attributes("data-modal"),
    ).toBe("true");
    const outside = new Event("interactOutside", { cancelable: true });
    card().vm.$emit("interactOutside", outside);
    expect(outside.defaultPrevented).toBe(true);
    expect(useTour().active.value).toBe(true);
  });

  it("opens on its Next button", async () => {
    const overlay = await startTour();

    const opening = new Event("openAutoFocus", { cancelable: true });
    card().vm.$emit("openAutoFocus", opening);

    expect(opening.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(
      overlay.find("[data-testid=tour-next]").element,
    );
  });

  it("hands focus to the profile menu as the card closes", async () => {
    await startTour();

    const closing = new Event("closeAutoFocus", { cancelable: true });
    card().vm.$emit("closeAutoFocus", closing);

    // reka would hand it to a trigger the card does not have
    expect(closing.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(document.getElementById("profile"));
  });

  it("hands focus to the menu button on a phone, where the profile is put away", async () => {
    layOutDesktop(["menu", "search", "player_bar", "player_select"]);
    await startTour();

    card().vm.$emit(
      "closeAutoFocus",
      new Event("closeAutoFocus", { cancelable: true }),
    );

    expect(document.activeElement).toBe(document.getElementById("menu"));
  });

  it("ends when the card is dismissed", async () => {
    await startTour();

    wrapper!.findComponent({ name: "Popover" }).vm.$emit("update:open", false);
    await flushPromises();

    expect(useTour().active.value).toBe(false);
  });

  it("ends from its close button", async () => {
    const overlay = await startTour();

    await overlay.find("[data-testid=tour-end]").trigger("click");
    await flushPromises();

    expect(useTour().active.value).toBe(false);
  });

  it("draws the spotlight around the stop and follows it", async () => {
    await startTour();

    // the box plus the margin the spotlight keeps around it
    expect(spotlight()?.style.top).toBe("54px");
    expect(spotlight()?.style.left).toBe("-6px");
    expect(spotlight()?.style.width).toBe("268px");
    expect(spotlight()?.style.height).toBe("512px");

    // the sidebar slides open under it: the next frame picks the move up
    placeAt(document.getElementById("menu")!, { ...BOXES.menu, width: 300 });
    runFrame();
    await nextTick();
    expect(spotlight()?.style.width).toBe("312px");
  });

  it("only walks the stops that are on screen", async () => {
    // a phone: the settings and the profile are behind the menu
    layOutDesktop(["menu", "search", "player_bar", "player_select"]);

    const overlay = await startTour();

    expect(overlay.find("[data-testid=tour-counter]").text()).toBe("1 of 4");
    await overlay.find("[data-testid=tour-next]").trigger("click");
    await overlay.find("[data-testid=tour-next]").trigger("click");
    expect(title()).toBe("tour.stops.player_bar.title");
  });

  it("ends at once with nothing to point at", async () => {
    document.body.innerHTML = "";

    await startTour();

    expect(useTour().active.value).toBe(false);
    expect(card().exists()).toBe(false);
  });

  it("ends when a stop goes off screen mid-run", async () => {
    const overlay = await startTour();
    document.getElementById("search")!.remove();

    await overlay.find("[data-testid=tour-next]").trigger("click");
    await flushPromises();

    expect(useTour().active.value).toBe(false);
  });

  it("follows a stop whose element the layout swaps out", async () => {
    await startTour();
    expect(card().props("reference")).toBe(document.getElementById("menu"));

    // the window shrinks to a phone's width: the sidebar goes, and the menu
    // is a button in the bottom bar from then on
    document.getElementById("menu")!.remove();
    const button = document.createElement("button");
    button.id = "menu-button";
    button.setAttribute("data-tour", "menu");
    document.body.append(button);
    placeAt(button, { top: 800, left: 12, width: 60, height: 44 });
    runFrame();
    await nextTick();

    expect(card().props("reference")).toBe(button);
    expect(card().props("side")).toBe("top");
    expect(spotlight()?.style.top).toBe("794px");
  });

  it("ends when the stop's element goes without a stand-in", async () => {
    await startTour();

    document.getElementById("menu")!.remove();
    runFrame();
    await flushPromises();

    expect(useTour().active.value).toBe(false);
    expect(frames.size).toBe(0);
  });

  it("clears the screen for the stops as it starts", async () => {
    store.navMenuEditMode = true;
    store.showPlayersMenu = true;
    store.showFullscreenPlayer = true;

    await startTour();

    expect(store.navMenuEditMode).toBe(false);
    expect(store.showPlayersMenu).toBe(false);
    expect(store.showFullscreenPlayer).toBe(false);
    expect(closeCommandCenter).toHaveBeenCalledTimes(1);
  });

  it("opens a collapsed sidebar for the run and collapses it again after", async () => {
    sidebar.collapsed.value = true;

    await startTour();
    expect(sidebar.setOpen).toHaveBeenCalledWith(true);

    useTour().end();
    await flushPromises();
    expect(sidebar.setOpen).toHaveBeenLastCalledWith(false);
  });

  it("leaves an open sidebar as it is", async () => {
    await startTour();
    useTour().end();
    await flushPromises();

    expect(sidebar.setOpen).not.toHaveBeenCalled();
  });

  it("closes the sidebar sheet on a phone instead", async () => {
    sidebar.isMobile.value = true;
    sidebar.collapsed.value = true;

    await startTour();

    expect(sidebar.setOpenMobile).toHaveBeenCalledWith(false);
    expect(sidebar.setOpen).not.toHaveBeenCalled();
  });

  it("scrolls the stop into view", async () => {
    const scrollIntoView = vi.fn();
    document.getElementById("menu")!.scrollIntoView = scrollIntoView;

    await startTour();

    expect(scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
      inline: "nearest",
    });
  });

  it("ends the tour when the layout goes away", async () => {
    sidebar.collapsed.value = true;
    const overlay = await startTour();

    overlay.unmount();

    expect(useTour().active.value).toBe(false);
    expect(sidebar.setOpen).toHaveBeenLastCalledWith(false);
    expect(spotlight()).toBeNull();
  });
});
