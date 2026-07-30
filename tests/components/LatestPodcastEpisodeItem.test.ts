import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LatestPodcastEpisodeItem from "@/components/LatestPodcastEpisodeItem.vue";
import { MediaType, type PodcastEpisode } from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import {
  handleMediaItemClick,
  handleMenuBtnClick,
  handlePlayBtnClick,
} from "@/helpers/utils";

vi.mock(import("@/helpers/utils"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    formatDuration: vi.fn(() => "1:00"),
    handleMediaItemClick: vi.fn(),
    handleMenuBtnClick: vi.fn(),
    handlePlayBtnClick: vi.fn(),
  };
});

vi.mock("@/helpers/podcast_latest", () => ({
  formatEpisodeReleaseDate: vi.fn(() => "Jan 1, 2024"),
}));

// A ListItem stub that forwards row-level click/menu events the way the real
// component wires them, so we can exercise the interaction split in isolation.
const ListItemStub = {
  name: "ListItem",
  emits: ["click", "menu"],
  template: `
    <div class="list-item-stub" @click="$emit('click', $event)">
      <slot name="prepend" />
      <slot name="title" />
      <slot name="subtitle" />
      <slot name="append" />
    </div>
  `,
};

const MediaItemThumbStub = {
  name: "MediaItemThumb",
  template: '<div class="media-item-thumb-stub" />',
};

function makeEpisode(overrides: Partial<PodcastEpisode> = {}): PodcastEpisode {
  return {
    item_id: "ep-1",
    provider: "test",
    name: "Episode One",
    media_type: MediaType.PODCAST_EPISODE,
    is_playable: true,
    podcast: { name: "The Podcast" },
    duration: 60,
    ...overrides,
  } as PodcastEpisode;
}

function mountItem(episode: PodcastEpisode) {
  return mount(LatestPodcastEpisodeItem, {
    props: { episode },
    global: {
      plugins: [i18n],
      mocks: { $vuetify: { display: { mobile: false } } },
      stubs: {
        ListItem: ListItemStub,
        MediaItemThumb: MediaItemThumbStub,
      },
    },
  });
}

describe("LatestPodcastEpisodeItem", () => {
  beforeEach(() => {
    vi.mocked(handleMediaItemClick).mockClear();
    vi.mocked(handlePlayBtnClick).mockClear();
    vi.mocked(handleMenuBtnClick).mockClear();
  });

  it("routes a row click through handleMediaItemClick and never direct play", async () => {
    const wrapper = mountItem(makeEpisode());

    await wrapper.get(".list-item-stub").trigger("click");

    expect(handleMediaItemClick).toHaveBeenCalledTimes(1);
    expect(handleMediaItemClick).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: "ep-1" }),
      expect.any(Number),
      expect.any(Number),
    );
    expect(handlePlayBtnClick).not.toHaveBeenCalled();
  });

  it("plays directly from the artwork/play overlay via handlePlayBtnClick", async () => {
    const wrapper = mountItem(makeEpisode());

    await wrapper.get(".latest-episode-thumb").trigger("click");

    expect(handlePlayBtnClick).toHaveBeenCalledTimes(1);
    expect(handlePlayBtnClick).toHaveBeenCalledWith(
      expect.objectContaining({ item_id: "ep-1" }),
      expect.any(Number),
      expect.any(Number),
    );
    // artwork click must not bubble up to the row's media-item handler
    expect(handleMediaItemClick).not.toHaveBeenCalled();
  });

  it("stays inert for non-playable episodes on both row and artwork clicks", async () => {
    const wrapper = mountItem(makeEpisode({ is_playable: false }));

    await wrapper.get(".list-item-stub").trigger("click");
    await wrapper.get(".latest-episode-thumb").trigger("click");

    expect(handleMediaItemClick).not.toHaveBeenCalled();
    expect(handlePlayBtnClick).not.toHaveBeenCalled();
  });
});
