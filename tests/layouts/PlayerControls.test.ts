import PlayerControls from "@/layouts/default/PlayerOSD/PlayerControls.vue";
import RepeatBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue";
import ShuffleBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleBtn.vue";
import SkipBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipBtn.vue";
import {
  MediaType,
  type PlayableMediaItemType,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queueItem } from "../fixtures/queueItem";

vi.mock("@/plugins/router", () => ({ default: { push: vi.fn() } }));

vi.mock("@/plugins/api", () => {
  const api = {
    subscribe: vi.fn(() => () => {}),
    providers: {},
    players: {},
  };
  return { api, default: api };
});

vi.mock("@/plugins/vuetify", () => ({
  default: { theme: { current: { value: { dark: false } } } },
}));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      activePlayerQueue: undefined,
      curQueueItem: undefined,
    }),
  };
});

const mockStore = store as unknown as { curQueueItem?: QueueItem };

function setPlaying(mediaType: MediaType) {
  mockStore.curQueueItem = queueItem({
    media_item: { media_type: mediaType } as PlayableMediaItemType,
  });
}

function mountControls() {
  return shallowMount(PlayerControls);
}

enableAutoUnmount(afterEach);

afterEach(() => {
  mockStore.curQueueItem = undefined;
});

describe("PlayerControls", () => {
  it.each([MediaType.AUDIOBOOK, MediaType.PODCAST_EPISODE])(
    "swaps shuffle and repeat for skip back and forward on a %s",
    (mediaType) => {
      setPlaying(mediaType);

      const wrapper = mountControls();

      const skips = wrapper.findAllComponents(SkipBtn);
      expect(skips.map((skip) => skip.props("direction"))).toEqual([
        "back",
        "forward",
      ]);
      expect(wrapper.findComponent(ShuffleBtn).exists()).toBe(false);
      expect(wrapper.findComponent(RepeatBtn).exists()).toBe(false);
    },
  );

  it("keeps shuffle and repeat for a track", () => {
    setPlaying(MediaType.TRACK);

    const wrapper = mountControls();

    expect(wrapper.findComponent(SkipBtn).exists()).toBe(false);
    expect(wrapper.findComponent(ShuffleBtn).exists()).toBe(true);
    expect(wrapper.findComponent(RepeatBtn).exists()).toBe(true);
  });

  it("hides skip with the shuffle and repeat positions", () => {
    setPlaying(MediaType.AUDIOBOOK);

    const wrapper = shallowMount(PlayerControls, {
      props: {
        visibleComponents: {
          shuffle: { isVisible: false },
          repeat: { isVisible: false },
          play: { isVisible: true },
        },
      },
    });

    expect(wrapper.findComponent(SkipBtn).exists()).toBe(false);
  });
});
