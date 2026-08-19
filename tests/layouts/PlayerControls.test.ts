import PlayerControls from "@/layouts/default/PlayerOSD/PlayerControls.vue";
import SkipBackBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipBackBtn.vue";
import SkipForwardBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipForwardBtn.vue";
import { MediaType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { store } = vi.hoisted(() => ({
  store: {
    activePlayerQueue: undefined as unknown,
    curQueueItem: undefined as
      | { media_item?: { media_type?: MediaType } }
      | undefined,
  },
}));

vi.mock("@/plugins/store", () => ({ store }));

vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({ getPreference: () => ({ value: 30 }) }),
}));

vi.mock("@/plugins/api/helpers", () => ({
  itemSupportsPlayLog: (item?: { media_type?: MediaType } | null) =>
    item?.media_type === MediaType.AUDIOBOOK ||
    item?.media_type === MediaType.PODCAST_EPISODE,
}));

vi.mock("@/layouts/default/PlayerOSD/PlayerControlBtn/SkipBackBtn.vue", () => ({
  default: { name: "SkipBackBtn", template: "<button data-skip-back />" },
}));

vi.mock(
  "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipForwardBtn.vue",
  () => ({
    default: {
      name: "SkipForwardBtn",
      template: "<button data-skip-forward />",
    },
  }),
);

vi.mock("@/layouts/default/PlayerOSD/PlayerControlBtn/PreviousBtn.vue", () => ({
  default: { template: "<button data-previous />" },
}));
vi.mock("@/layouts/default/PlayerOSD/PlayerControlBtn/NextBtn.vue", () => ({
  default: { template: "<button data-next />" },
}));
vi.mock("@/layouts/default/PlayerOSD/PlayerControlBtn/PlayBtn.vue", () => ({
  default: { template: "<button data-play />" },
}));
vi.mock("@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleBtn.vue", () => ({
  default: { template: "<button data-shuffle />" },
}));
vi.mock("@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue", () => ({
  default: { template: "<button data-repeat />" },
}));

describe("PlayerControls long-form skip visibility", () => {
  beforeEach(() => {
    store.curQueueItem = undefined;
  });

  it.each([MediaType.AUDIOBOOK, MediaType.PODCAST_EPISODE])(
    "shows both skip controls for %s",
    async (mediaType) => {
      store.curQueueItem = { media_item: { media_type: mediaType } };
      const wrapper = mount(PlayerControls);

      await nextTick();

      expect(wrapper.find("[data-skip-back]").exists()).toBe(true);
      expect(wrapper.find("[data-skip-forward]").exists()).toBe(true);
    },
  );

  it.each([MediaType.TRACK, MediaType.PODCAST])(
    "hides both skip controls for %s",
    async (mediaType) => {
      store.curQueueItem = { media_item: { media_type: mediaType } };
      const wrapper = mount(PlayerControls);

      await nextTick();

      expect(wrapper.find("[data-skip-back]").exists()).toBe(false);
      expect(wrapper.find("[data-skip-forward]").exists()).toBe(false);
    },
  );
});
