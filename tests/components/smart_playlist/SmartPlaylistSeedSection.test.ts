import SmartPlaylistSeedPicker from "@/components/smart_playlist/SmartPlaylistSeedPicker.vue";
import SmartPlaylistSeedSection from "@/components/smart_playlist/SmartPlaylistSeedSection.vue";
import {
  useSmartPlaylistSeedItems,
  type SeedKind,
} from "@/composables/smart-playlist/useSmartPlaylistSeedItems";
import api from "@/plugins/api";
import type { SearchResults } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";
import { album } from "../../fixtures/album";
import { artist } from "../../fixtures/artist";
import { playlist } from "../../fixtures/playlist";
import { track } from "../../fixtures/track";

vi.mock("@/plugins/store", () => ({ store: { isTouchscreen: false } }));

vi.mock("@/plugins/api", () => ({
  default: {
    providers: {
      spotify_instance: {
        instance_id: "spotify_instance",
        supported_features: ["similar_tracks"],
      },
    },
    search: vi.fn(),
  },
}));

const searchResults = (found: Partial<SearchResults>): SearchResults => ({
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
  radio: [],
  podcasts: [],
  audiobooks: [],
  genres: [],
  ...found,
});

const items = {
  track: track({ name: "Waterloo" }),
  artist: artist({ name: "ABBA" }),
  album: album({ name: "Arrival" }),
  playlist: playlist({ name: "ABBA Gold" }),
};
const everyKind = searchResults({
  tracks: [items.track],
  artists: [items.artist],
  albums: [items.album],
  playlists: [items.playlist],
});
const kinds = Object.keys(items) as SeedKind[];

enableAutoUnmount(afterEach);

describe("SmartPlaylistSeedSection", () => {
  let scope: EffectScope;

  // the picker is stubbed with its real props, so no popover has to open
  function mountSection() {
    scope = effectScope();
    const seedItems = scope.run(() => useSmartPlaylistSeedItems())!;
    const wrapper = mount(SmartPlaylistSeedSection, {
      props: { seedItems },
      global: { stubs: { SmartPlaylistSeedPicker: true } },
    });
    return {
      picker: wrapper.findComponent(SmartPlaylistSeedPicker),
      seedItems,
    };
  }

  afterEach(() => {
    scope.stop();
    vi.mocked(api.search).mockReset();
  });

  it("searches only when the picker submits and feeds the results back", async () => {
    const pending = Promise.withResolvers<SearchResults>();
    vi.mocked(api.search).mockReturnValueOnce(pending.promise);
    const { picker } = mountSection();

    picker.vm.$emit("update:searchQuery", "abba");
    await nextTick();

    expect(api.search).not.toHaveBeenCalled();
    expect(picker.props("searchQuery")).toBe("abba");
    expect(picker.props("isSubmitted")).toBe(false);

    picker.vm.$emit("submit");
    await nextTick();

    expect(api.search).toHaveBeenCalledWith("abba", ["track"], 20);
    expect(picker.props("isSearching")).toBe(true);
    expect(picker.props("isSubmitted")).toBe(true);

    const waterloo = track({ item_id: "1", name: "Waterloo" });
    pending.resolve(searchResults({ tracks: [waterloo] }));
    await flushPromises();

    expect(picker.props("results")).toEqual([waterloo]);
    expect(picker.props("isSearching")).toBe(false);
    expect(picker.props("isSubmitted")).toBe(true);

    picker.vm.$emit("update:searchQuery", "abba gold");
    await nextTick();

    expect(picker.props("isSubmitted")).toBe(false);
    expect(picker.props("results")).toEqual([]);
    expect(api.search).toHaveBeenCalledTimes(1);
  });

  it.each(kinds)("searches and adds a seed of kind %s", async (kind) => {
    const item = items[kind];
    vi.mocked(api.search).mockResolvedValueOnce(everyKind);
    const { picker, seedItems } = mountSection();

    picker.vm.$emit("update:kind", kind);
    picker.vm.$emit("update:searchQuery", "abba");
    await nextTick();
    picker.vm.$emit("submit");
    await flushPromises();

    expect(picker.props("kind")).toBe(kind);
    expect(api.search).toHaveBeenCalledExactlyOnceWith("abba", [kind], 20);
    expect(picker.props("results")).toEqual([item]);

    picker.vm.$emit("select", item);
    await nextTick();

    expect(seedItems.seeds.value).toEqual([
      expect.objectContaining({ kind, name: item.name, uri: item.uri }),
    ]);
    expect(picker.props("searchQuery")).toBe("");
    expect(picker.props("results")).toEqual([]);
  });

  it.each(kinds)("keeps the %s search to its own kind", async (kind) => {
    const pending = Promise.withResolvers<SearchResults>();
    vi.mocked(api.search).mockReturnValueOnce(pending.promise);
    const { picker } = mountSection();
    const other = kinds.find((k) => k !== kind)!;
    const idle = {
      searchQuery: "",
      results: [],
      isSearching: false,
      isSubmitted: false,
    };

    picker.vm.$emit("update:kind", kind);
    picker.vm.$emit("update:searchQuery", "abba");
    await nextTick();
    picker.vm.$emit("submit");
    await nextTick();

    expect(picker.props()).toMatchObject({
      searchQuery: "abba",
      results: [],
      isSearching: true,
      isSubmitted: true,
    });

    picker.vm.$emit("update:kind", other);
    await nextTick();

    expect(picker.props()).toMatchObject(idle);

    pending.resolve(everyKind);
    await flushPromises();

    expect(picker.props()).toMatchObject(idle);

    picker.vm.$emit("update:kind", kind);
    await nextTick();

    expect(picker.props()).toMatchObject({
      searchQuery: "abba",
      results: [items[kind]],
      isSearching: false,
      isSubmitted: true,
    });
  });
});
