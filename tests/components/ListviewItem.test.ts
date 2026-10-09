/**
 * The row's own looks for a release that is not in the library: the muted
 * treatment (instead of the unavailable one), its artwork kept, and a subtitle
 * that says where it stands. Also the subtitle of a slim album mapping and of a
 * podcast episode.
 */
import ListviewItem from "@/components/ListviewItem.vue";
import {
  AlbumType,
  MediaType,
  type Album,
  type ItemMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { podcastEpisode } from "../fixtures/podcastEpisode";

vi.mock("@/plugins/api", () => {
  const api = { providers: {} };
  return { api, default: api };
});

vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: vi.fn(),
  handleMenuBtnClick: vi.fn(),
  handlePlayBtnClick: vi.fn(),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: () => true },
}));

vi.mock("@/plugins/breakpoint", () => ({ getBreakpointValue: () => false }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the vuetify list row and the title carry their own looks; the row's classes
// land on the stub, so both the class and the subtitle can be read off it
vi.mock("@/components/ListItem.vue", () => ({
  default: {
    name: "ListItem",
    template:
      '<div><span class="subtitle"><slot name="subtitle" /></span><slot name="prepend" /></div>',
  },
}));
vi.mock("@/components/ListviewItemTitle.vue", () => ({
  default: { name: "ListviewItemTitle", props: ["item"], template: "<span />" },
}));
vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { name: "MediaItemThumb", props: ["item"], template: "<img />" },
}));

const release = (overrides: Partial<Album> = {}) =>
  album({
    item_id: "rg-1",
    provider: "musicbrainz",
    provider_mappings: [],
    name: "Grace",
    artists: [artist({ name: "Jeff Buckley" })],
    ...overrides,
  });

function mountRow(item: MediaItemType, isAvailable = true) {
  return mount(ListviewItem, {
    props: { item, isSelected: false, isAvailable },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("ListviewItem for a release that is not in the library", () => {
  it("mutes the row instead of greying it out", () => {
    const wrapper = mountRow(release(), false);
    const row = wrapper.getComponent({ name: "ListItem" });

    expect(row.classes()).toContain("not-in-library");
    expect(row.classes()).not.toContain("unavailable");
  });

  // an unavailable row is handed no item at all, which blanks its artwork
  it("keeps showing its artwork", () => {
    const wrapper = mountRow(release(), false);

    expect(
      wrapper.getComponent({ name: "MediaItemThumb" }).props("item"),
    ).toMatchObject({ item_id: "rg-1" });
  });

  // the play overlay follows availability, not the release's own flag
  it("offers no play button", () => {
    const wrapper = mountRow(release(), false);

    expect(wrapper.find(".listitem-play-blue").exists()).toBe(false);
    expect(wrapper.find(".is-playable").exists()).toBe(false);
  });

  it("says it is not in the library, with the year", () => {
    const wrapper = mountRow(release({ year: 1994 }));

    expect(wrapper.get(".subtitle").text()).toBe("not_in_library • 1994");
  });

  it("keeps the play button on a release that is on a music service", () => {
    const wrapper = mountRow(album({ item_id: "1" }));

    expect(wrapper.find(".listitem-play-blue").exists()).toBe(true);
  });

  it("describes a release that is on a music service as before", () => {
    const wrapper = mountRow(
      album({
        item_id: "1",
        album_type: AlbumType.SINGLE,
        artists: [artist({ name: "Jeff Buckley" })],
        year: 1994,
      }),
    );

    expect(wrapper.get(".subtitle").text()).toBe(
      "album_type.single • Jeff Buckley • 1994",
    );
  });
});

// a track's album is a slim mapping, e.g. in an artist's "Appears on" list
describe("ListviewItem for an album mapping", () => {
  it("shows only its year", () => {
    const mapping: ItemMapping = {
      item_id: "2",
      provider: "library",
      name: "CM",
      version: "",
      uri: "library://album/2",
      external_ids: [],
      is_playable: true,
      media_type: MediaType.ALBUM,
      available: true,
      year: 2009,
    };

    // the listing hands mappings over cast to full media items
    const wrapper = mountRow(mapping as unknown as Album);

    expect(wrapper.get(".subtitle").text()).toBe("2009");
  });
});

describe("ListviewItem for a podcast episode", () => {
  it("shows the publisher's season and episode number", () => {
    const wrapper = mountRow(podcastEpisode({ season: 1, episode_number: 53 }));

    const subtitle = wrapper.get(".subtitle");
    expect(subtitle.get("[aria-hidden='true']").text()).toBe(
      "season_episode_number_short",
    );
    expect(subtitle.get(".sr-only").text()).toBe("season_episode_number");
  });

  it("shows nothing for an episode without a number", () => {
    const wrapper = mountRow(podcastEpisode());

    expect(wrapper.get(".subtitle").text()).toBe("");
  });
});
