import DynamicItemSample from "@/components/DynamicItemSample.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { Playlist, Radio } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { radio } from "../fixtures/radio";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { track } from "../fixtures/track";

const { mockGetPlaylistTracks, mockGetRadioTracks, apiMock } = vi.hoisted(
  () => {
    const mockGetPlaylistTracks =
      vi.fn<MusicAssistantApi["getPlaylistTracks"]>();
    const mockGetRadioTracks = vi.fn<MusicAssistantApi["getRadioTracks"]>();
    return {
      mockGetPlaylistTracks,
      mockGetRadioTracks,
      apiMock: {
        providers: {},
        getPlaylistTracks: mockGetPlaylistTracks,
        getRadioTracks: mockGetRadioTracks,
      },
    };
  },
);

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: { activePlayer: undefined, curQueueItem: undefined },
}));

// signed in as a member unless a test says otherwise
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../fixtures/scopes");
  return {
    authManager: { hasScope: vi.fn(scopeChecker(BUILTIN_ROLE_SCOPES.user)) },
  };
});

// the real component pulls in router/toast/breakpoint machinery this suite
// doesn't need; a minimal stand-in keeps the sample's own tracks assertable
vi.mock("@/components/ListviewItem.vue", () => ({
  default: {
    name: "ListviewItem",
    props: ["item"],
    template: '<div class="listview-item-stub">{{ item.name }}</div>',
  },
}));

function mountSample(itemDetails: Playlist | Radio) {
  return mount(DynamicItemSample, {
    props: { itemDetails, provider: "spotify" },
    global: {
      mocks: { $t: (key: string) => key },
      // the decorative badge icon needs a real Vuetify instance to render;
      // it's irrelevant to this component's branching logic
      stubs: { VIcon: true },
    },
  });
}

describe("DynamicItemSample", () => {
  beforeEach(() => {
    mockGetPlaylistTracks.mockReset();
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
    mockGetRadioTracks.mockReset();
  });

  it("loads and renders tracks from a dynamic playlist", async () => {
    mockGetPlaylistTracks.mockResolvedValue([
      track({ item_id: "1", name: "Track one" }),
      track({ item_id: "2", name: "Track two" }),
    ]);
    const wrapper = mountSample(
      playlist({ item_id: "p1", provider: "library", is_dynamic: true }),
    );
    await flushPromises();

    expect(mockGetPlaylistTracks).toHaveBeenCalledWith("p1", "spotify", false);
    expect(mockGetRadioTracks).not.toHaveBeenCalled();
    expect(
      wrapper.findAll(".listview-item-stub").map((item) => item.text()),
    ).toEqual(["Track one", "Track two"]);
    expect(wrapper.text()).toContain("smart_playlist.dynamic_sample_heading");
  });

  it("loads and renders tracks from a dynamic radio", async () => {
    mockGetRadioTracks.mockResolvedValue([
      track({ item_id: "1", name: "Sample one" }),
    ]);
    const wrapper = mountSample(
      radio({ item_id: "r1", provider: "library", is_dynamic: true }),
    );
    await flushPromises();

    expect(mockGetRadioTracks).toHaveBeenCalledWith("r1", "spotify");
    expect(mockGetPlaylistTracks).not.toHaveBeenCalled();
    expect(
      wrapper.findAll(".listview-item-stub").map((item) => item.text()),
    ).toEqual(["Sample one"]);
    expect(wrapper.text()).toContain("dynamic_radio_heading");
  });

  it("offers to edit the rules of an empty dynamic playlist", async () => {
    mockGetPlaylistTracks.mockResolvedValue([]);
    const wrapper = mountSample(playlist({ is_dynamic: true }));
    await flushPromises();

    expect(wrapper.text()).toContain("smart_playlist.empty_desc");
    expect(wrapper.find('[data-slot="button"]').exists()).toBe(true);

    await wrapper.find('[data-slot="button"]').trigger("click");
    expect(wrapper.emitted("edit-rules")).toHaveLength(1);
  });

  it("offers no rule editing to a role that may not change the library", async () => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );
    mockGetPlaylistTracks.mockResolvedValue([]);
    const wrapper = mountSample(playlist({ is_dynamic: true }));
    await flushPromises();

    expect(wrapper.text()).toContain("smart_playlist.empty_desc");
    expect(wrapper.find('[data-slot="button"]').exists()).toBe(false);
  });

  it("has no rules to edit for an empty dynamic radio", async () => {
    mockGetRadioTracks.mockResolvedValue([]);
    const wrapper = mountSample(radio({ is_dynamic: true }));
    await flushPromises();

    expect(wrapper.text()).toContain("dynamic_radio_empty_desc");
    expect(wrapper.find('[data-slot="button"]').exists()).toBe(false);
  });
});
