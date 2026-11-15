import ArtistSimilarShelf from "@/components/artist/ArtistSimilarShelf.vue";
import ArtistTopTracksRow from "@/components/artist/ArtistTopTracksRow.vue";
import type { Artist, Track } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

// slot-rendering stubs so the components' own markup (the empty line) shows,
// while their heavy children stay out of the way
const stubs = {
  EditorialShelf: { template: "<div><slot /></div>" },
  EditorialMediaCard: { template: "<div><slot /></div>" },
  EditorialCardSkeleton: { template: '<div class="skeleton" />' },
  RowSourceBadge: { template: "<div />" },
  MediaItemThumb: { template: "<div />" },
  ExplicitBadge: { template: "<div />" },
  Skeleton: { template: '<div class="skeleton" />' },
  RouterLink: { template: "<a><slot /></a>" },
};

const EMPTY = "Nothing to show here.";
const options = { global: { stubs, mocks: { $t: (key: string) => key } } };
const artist = { item_id: "1", provider: "spotify" } as Artist;

describe("artist row empty state", () => {
  it("shows the empty line when top tracks resolve to nothing", () => {
    const wrapper = mount(ArtistTopTracksRow, {
      props: { artist, tracks: [] as Track[], emptyMessage: EMPTY },
      ...options,
    });
    expect(wrapper.find(".artist-top-tracks__empty").text()).toBe(EMPTY);
  });

  it("hides the empty line while top tracks are still loading", () => {
    const wrapper = mount(ArtistTopTracksRow, {
      props: { artist, tracks: undefined, emptyMessage: EMPTY },
      ...options,
    });
    expect(wrapper.find(".artist-top-tracks__empty").exists()).toBe(false);
  });

  it("shows the empty line when similar artists resolve to nothing", () => {
    const wrapper = mount(ArtistSimilarShelf, {
      props: { items: [] as Artist[], emptyMessage: EMPTY },
      ...options,
    });
    expect(wrapper.find(".artist-similar__empty").text()).toBe(EMPTY);
  });

  it("hides the empty line while similar artists are still loading", () => {
    const wrapper = mount(ArtistSimilarShelf, {
      props: { items: undefined, emptyMessage: EMPTY },
      ...options,
    });
    expect(wrapper.find(".artist-similar__empty").exists()).toBe(false);
  });
});
