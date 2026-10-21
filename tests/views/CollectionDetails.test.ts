import type { MusicAssistantApi } from "@/plugins/api";
import type { LoadDataParams } from "@/composables/useItemsListing";
import { type Audiobook, type MediaCollection } from "@/plugins/api/interfaces";
import CollectionDetails from "@/views/CollectionDetails.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAudiobookCollection } = vi.hoisted(() => ({
  getAudiobookCollection: vi.fn<MusicAssistantApi["getAudiobookCollection"]>(),
}));

vi.mock("@/plugins/api", () => ({
  api: { getAudiobookCollection, subscribe: () => () => {} },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/components/collection/CollectionHero.vue", () => ({
  default: { name: "CollectionHero", props: ["item"], template: "<div />" },
}));
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["loadPagedData", "parentItem"],
    template: "<div />",
  },
}));

describe("CollectionDetails", () => {
  beforeEach(() => {
    getAudiobookCollection.mockReset().mockResolvedValue({
      item_id: "audiobook___Test Collection",
      name: "Test Collection",
      provider: "library",
      provider_mappings: [],
      items: [] as Audiobook[],
    } as unknown as MediaCollection<Audiobook>);
  });

  it("loads collection pages from the server", async () => {
    const wrapper = mount(CollectionDetails, {
      props: {
        itemId: "audiobook___Test Collection",
        provider: "library",
      },
    });
    await flushPromises();
    const listing = wrapper.findComponent({ name: "ItemsListing" });
    const params: LoadDataParams = {
      offset: 40,
      limit: 20,
      sortBy: "original",
      search: "chapter",
      favoritesOnly: true,
    };

    await (
      listing.props("loadPagedData") as (
        params: LoadDataParams,
      ) => Promise<unknown[]>
    )(params);

    expect(getAudiobookCollection).toHaveBeenNthCalledWith(
      2,
      "audiobook___Test Collection",
      "chapter",
      20,
      40,
      true,
    );
    expect(listing.props("parentItem")).toMatchObject({
      item_id: "audiobook___Test Collection",
    });
  });

  it("remounts the listing and resets its header when the collection changes", async () => {
    const wrapper = mount(CollectionDetails, {
      props: { itemId: "audiobook___First", provider: "library" },
    });
    const listing = wrapper.findComponent({ name: "ItemsListing" });
    await listing.props("loadPagedData")({
      offset: 0,
      limit: 50,
      sortBy: "original",
    });
    await flushPromises();
    expect(
      wrapper.findComponent({ name: "CollectionHero" }).props("item"),
    ).toBeDefined();

    await wrapper.setProps({ itemId: "audiobook___Second" });

    const nextListing = wrapper.findComponent({ name: "ItemsListing" });
    expect(nextListing.vm).not.toBe(listing.vm);
    expect(
      wrapper.findComponent({ name: "CollectionHero" }).props("item"),
    ).toBeUndefined();
    await nextListing.props("loadPagedData")({
      offset: 0,
      limit: 50,
      sortBy: "original",
    });
    expect(getAudiobookCollection).toHaveBeenCalledWith(
      "audiobook___Second",
      undefined,
      0,
    );
  });
});
