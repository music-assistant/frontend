import LiveSourceCard from "@/components/live-sources/LiveSourceCard.vue";
import LiveSourceListItem from "@/components/live-sources/LiveSourceListItem.vue";
import TouchEvents from "@/plugins/touchEvents";
import { AudioLines } from "@lucide/vue";
import { mount } from "@vue/test-utils";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { markRaw, type Component } from "vue";
import { playerSource } from "../fixtures/playerSource";

vi.mock("@/plugins/breakpoint", () => ({ getBreakpointValue: () => false }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
// a touch screen, where the row has a play button of its own
vi.mock("@vueuse/core", async (importOriginal) => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...(await importOriginal<typeof import("@vueuse/core")>()),
    useMediaQuery: () => ref(true),
  };
});

const SOURCE = playerSource({ id: "line_in", name: "Line-in", is_input: true });

function touchStart(target: Element): Event {
  const evt = new Event("touchstart", { bubbles: true, cancelable: true });
  const touch = { clientX: 10, clientY: 10, target };
  Object.assign(evt, { touches: [touch], changedTouches: [touch] });
  return evt;
}

// a long-press on the element, then the click of the finger-lift
function holdAndRelease(target: Element) {
  target.dispatchEvent(touchStart(target));
  vi.advanceTimersByTime(600);
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function mountItem(item: Component, props: Record<string, unknown> = {}) {
  return mount(item, {
    props: {
      source: SOURCE,
      icon: markRaw(AudioLines),
      isPlaying: false,
      ...props,
    },
    global: {
      plugins: [TouchEvents],
      mocks: { $t: (key: string) => key },
      stubs: { NowPlayingBadge: true },
    },
  });
}

describe.each([
  {
    kind: "list row",
    item: LiveSourceListItem,
    props: {},
    edge: "[data-slot=item]",
    body: "[data-slot=item-title]",
    playButton: "button[aria-label^=play]",
  },
  {
    kind: "card",
    item: LiveSourceCard,
    props: { showActions: true },
    edge: "[role=button]",
    body: "[data-card-art]",
    playButton: "span.bg-primary",
  },
])("the $kind of a live source", ({ item, props, edge, body, playButton }) => {
  beforeAll(() => {
    // v-hold only binds touch events when the browser reports touch support
    (window as unknown as { ontouchstart: null }).ontouchstart = null;
  });
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([
    ["itself", body],
    ["its play button", playButton],
  ])("starts the source on a tap on %s", (_target, selector) => {
    const wrapper = mountItem(item, props);
    wrapper.find(selector).trigger("click");
    expect(wrapper.emitted("start")).toHaveLength(1);
  });

  it.each([
    ["itself", body],
    ["its play button", playButton],
    ["its edge", edge],
  ])(
    "opens the menu on a long-press on %s, without starting the source",
    (_target, selector) => {
      const wrapper = mountItem(item, props);
      holdAndRelease(wrapper.find(selector).element);
      expect(wrapper.emitted("menu")).toHaveLength(1);
      expect(wrapper.emitted("start")).toBeUndefined();
    },
  );

  it.each(["Enter", " "])("starts the source with %j", (key) => {
    const wrapper = mountItem(item, props);
    wrapper.find(edge).trigger("keydown", { key });
    expect(wrapper.emitted("start")).toHaveLength(1);
  });

  it("opens the menu on a right-click", () => {
    const wrapper = mountItem(item, props);
    wrapper.find(body).trigger("contextmenu");
    expect(wrapper.emitted("menu")).toHaveLength(1);
    expect(wrapper.emitted("start")).toBeUndefined();
  });

  it("opens the menu with its menu button, labelled with the source", () => {
    const wrapper = mountItem(item, props);
    const button = wrapper.find("button[aria-label='more_options: Line-in']");
    button.trigger("click");
    expect(wrapper.emitted("menu")).toHaveLength(1);
    expect(wrapper.emitted("start")).toBeUndefined();
  });

  it("starts the source on the next tap after a long-press", () => {
    const wrapper = mountItem(item, props);
    const target = wrapper.find(body).element;
    holdAndRelease(target);
    target.dispatchEvent(touchStart(target));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(wrapper.emitted("start")).toHaveLength(1);
  });
});
