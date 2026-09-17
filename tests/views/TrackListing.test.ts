import type { MusicAssistantApi } from "@/plugins/api";
import type { Track } from "@/plugins/api/interfaces";
import TrackListing, { type Props } from "@/views/TrackListing.vue";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { track } from "../fixtures/track";

enableAutoUnmount(afterEach);

const { mockGetTrack } = vi.hoisted(() => ({
  mockGetTrack: vi.fn<MusicAssistantApi["getTrack"]>(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getTrack: mockGetTrack,
    providers: {},
  },
}));

const { routerMock } = vi.hoisted(() => ({
  routerMock: {
    options: { history: { state: { back: null as string | null } } },
    back: vi.fn(),
    push: vi.fn(),
  },
}));
vi.mock("vue-router", () => ({ useRouter: () => routerMock }));

// the stub renders path/itemtype so tests can read which preference key
// (see userPreferences.ts's getItemsListingPreferences) the listing was given
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["path", "itemtype"],
    template:
      '<div class="items-listing-stub" :data-path="path" :data-itemtype="itemtype" />',
  },
}));

async function mountListing(
  listing: string,
  item: Track = track(),
  albumUri?: string,
) {
  mockGetTrack.mockResolvedValue(item);
  const wrapper = mount(TrackListing, {
    // the route hands the view whatever string is in the url
    props: {
      itemId: item.item_id,
      provider: item.provider,
      listing: listing as Props["listing"],
      album: albumUri,
    },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function listingAttributes(wrapper: VueWrapper) {
  const listing = wrapper.find(".items-listing-stub");
  return {
    path: listing.attributes("data-path"),
    itemtype: listing.attributes("data-itemtype"),
  };
}

describe("TrackListing", () => {
  beforeEach(() => {
    mockGetTrack.mockReset();
    routerMock.back.mockClear();
    routerMock.push.mockClear();
    routerMock.options.history.state.back = null;
  });

  it("renders the similar tracks as their own listing", async () => {
    const wrapper = await mountListing(
      "similar",
      track({ item_id: "7", provider: "spotify--abc" }),
    );
    expect(mockGetTrack).toHaveBeenCalledWith("7", "spotify--abc", undefined);
    expect(listingAttributes(wrapper)).toEqual({
      path: "tracksimilar",
      itemtype: "similartracks",
    });
  });

  it("asks for the track on the album it was opened from", async () => {
    await mountListing(
      "similar",
      track({ item_id: "7", provider: "spotify--abc" }),
      "library://album/3",
    );
    expect(mockGetTrack).toHaveBeenCalledWith(
      "7",
      "spotify--abc",
      "library://album/3",
    );
  });

  it.each([null, "/tracks"])(
    "Escape preserves back semantics and album context with history %s",
    async (back) => {
      routerMock.options.history.state.back = back;
      const item = track({ item_id: "track-a", provider: "spotify--abc" });
      const wrapper = await mountListing("similar", item, "library://album/3");
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      if (back) {
        expect(routerMock.back).toHaveBeenCalledTimes(1);
        expect(routerMock.push).not.toHaveBeenCalled();
      } else {
        expect(routerMock.push).toHaveBeenCalledExactlyOnceWith({
          name: "track",
          params: { provider: item.provider, itemId: item.item_id },
          query: { album: "library://album/3" },
        });
        expect(routerMock.back).not.toHaveBeenCalled();
      }
      wrapper.unmount();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(
        routerMock.back.mock.calls.length + routerMock.push.mock.calls.length,
      ).toBe(1);
    },
  );

  it("renders nothing for an unknown listing", async () => {
    const wrapper = await mountListing("bogus");
    expect(wrapper.find(".items-listing-stub").exists()).toBe(false);
  });

  it("uses the same listing path for every track", async () => {
    const wrapperA = await mountListing(
      "similar",
      track({ item_id: "track-a" }),
    );
    const wrapperB = await mountListing(
      "similar",
      track({ item_id: "track-b" }),
    );

    // the path must not embed the track id, otherwise each track gets its
    // own view mode/sort/filter preferences instead of sharing one
    expect(listingAttributes(wrapperA).path).not.toContain("track-a");
    expect(listingAttributes(wrapperA).path).toBe(
      listingAttributes(wrapperB).path,
    );
  });
});
