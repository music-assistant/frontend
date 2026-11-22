import SmartPlaylistSeedPicker from "@/components/smart_playlist/SmartPlaylistSeedPicker.vue";
import SmartPlaylistSeedSection from "@/components/smart_playlist/SmartPlaylistSeedSection.vue";
import { useSmartPlaylistSeedItems } from "@/composables/smart-playlist/useSmartPlaylistSeedItems";
import api from "@/plugins/api";
import type { SearchResults, Track } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick, type EffectScope } from "vue";
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

const searchResults = (tracks: Track[]): SearchResults => ({
  tracks,
  artists: [],
  albums: [],
  playlists: [],
  radio: [],
  podcasts: [],
  audiobooks: [],
  genres: [],
});

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
    return wrapper.findComponent(SmartPlaylistSeedPicker);
  }

  afterEach(() => {
    scope.stop();
    vi.mocked(api.search).mockReset();
  });

  it("searches only when the picker submits and feeds the results back", async () => {
    const pending = Promise.withResolvers<SearchResults>();
    vi.mocked(api.search).mockReturnValueOnce(pending.promise);
    const picker = mountSection();

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
    pending.resolve(searchResults([waterloo]));
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
});
