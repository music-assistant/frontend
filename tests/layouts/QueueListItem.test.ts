import QueueListItem from "@/layouts/default/PlayerOSD/QueueListItem.vue";
import TouchEvents from "@/plugins/touchEvents";
import type { QueueItem } from "@/plugins/api/interfaces";
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

vi.mock("@/plugins/router", () => ({ default: { push: vi.fn() } }));
vi.mock("@/plugins/api", () => {
  const api = { subscribe: vi.fn(() => () => {}), providers: {}, players: {} };
  return { api, default: api };
});
vi.mock("@/plugins/vuetify", () => ({
  default: { theme: { current: { value: { dark: false } } } },
}));
vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return { store: reactive({ activePlayer: undefined, isTouchscreen: true }) };
});
vi.mock("@/composables/useActiveTrackWaveform", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return { useActiveTrackWaveform: () => ({ waveformBins: ref(null) }) };
});

const item = {
  queue_item_id: "qi1",
  queue_id: "q1",
  name: "Some song",
  duration: 200,
  available: true,
  media_item: undefined,
  extra_attributes: {},
} as unknown as QueueItem;

function touchStart(target: Element): Event {
  const evt = new Event("touchstart", { bubbles: true, cancelable: true });
  const touch = { clientX: 10, clientY: 10, target };
  Object.assign(evt, { touches: [touch], changedTouches: [touch] });
  return evt;
}

function mountItem() {
  return mount(QueueListItem, {
    props: { item, state: "upcoming" },
    global: {
      plugins: [TouchEvents],
      stubs: {
        MediaItemThumb: true,
        MarqueeText: { template: "<div><slot /></div>" },
        MiniEqualizer: true,
        NowPlayingBadge: true,
        PartyPlayerBadge: true,
      },
    },
  });
}

describe("QueueListItem long-press", () => {
  beforeAll(() => {
    // v-hold only binds touch events when the browser reports touch support
    (window as unknown as { ontouchstart: null }).ontouchstart = null;
  });
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("opens the menu when holding the row", () => {
    const wrapper = mountItem();
    const title = wrapper.find(".qitem__title").element;

    title.dispatchEvent(touchStart(title));
    vi.advanceTimersByTime(600);

    expect(wrapper.emitted("menu")).toHaveLength(1);
  });

  it("starts a drag without opening the menu when holding the grip", () => {
    const wrapper = mountItem();
    const grip = wrapper.find(".qitem__grip").element;

    grip.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
      }),
    );
    grip.dispatchEvent(touchStart(grip));
    vi.advanceTimersByTime(600);

    expect(wrapper.emitted("dragstart")).toHaveLength(1);
    expect(wrapper.emitted("menu")).toBeUndefined();
  });

  it("does not open the menu on a contextmenu event from the grip", async () => {
    const wrapper = mountItem();

    await wrapper.find(".qitem__grip").trigger("contextmenu");

    expect(wrapper.emitted("menu")).toBeUndefined();
  });
});
