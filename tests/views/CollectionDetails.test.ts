import type { MusicAssistantApi } from "@/plugins/api";
import type { LoadDataParams } from "@/composables/useItemsListing";
import {
  ListingType,
  type Audiobook,
  type MediaCollection,
} from "@/plugins/api/interfaces";
import CollectionDetails from "@/views/CollectionDetails.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAudiobookCollection } = vi.hoisted(() => ({
  getAudiobookCollection: vi.fn<MusicAssistantApi["getAudiobookCollection"]>(),
}));

vi.mock("@/plugins/api", () => ({
  api: { getAudiobookCollection },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/components/InfoHeader.vue", () => ({
  default: { name: "InfoHeader", props: ["item"], template: "<div />" },
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

  it("keeps the full collection in the header while loading pages", async () => {
    const books = [
      { item_id: "book-1", name: "First book" },
      { item_id: "book-2", name: "Second book" },
    ] as Audiobook[];
    const fullCollection = {
      item_id: "audiobook___Test Collection",
      name: "Test Collection",
      provider: "library",
      provider_mappings: [],
      items: books,
    } as unknown as MediaCollection<Audiobook>;
    getAudiobookCollection.mockResolvedValueOnce(fullCollection);
    const wrapper = mount(CollectionDetails, {
      props: {
        itemId: "audiobook___Test Collection",
        provider: "library",
      },
    });
    await flushPromises();

    expect(getAudiobookCollection).toHaveBeenNthCalledWith(
      1,
      "audiobook___Test Collection",
      undefined,
      0,
    );
    const infoHeader = wrapper.findComponent({ name: "InfoHeader" });
    const loadPagedData = wrapper
      .findComponent({ name: "ItemsListing" })
      .props("loadPagedData") as (params: LoadDataParams) => Promise<unknown[]>;

    getAudiobookCollection.mockResolvedValueOnce({
      ...fullCollection,
      items: [],
    });
    expect(
      await loadPagedData({
        offset: 50,
        limit: 50,
        search: "",
        sortBy: "original",
      }),
    ).toEqual([]);
    expect(infoHeader.props("item")).toEqual(fullCollection);

    getAudiobookCollection.mockResolvedValueOnce({
      ...fullCollection,
      items: [books[0]],
    });
    await loadPagedData({
      offset: 0,
      limit: 50,
      search: "First",
      sortBy: "original",
      favoritesOnly: true,
    });
    expect(infoHeader.props("item")).toEqual(fullCollection);
  });
});
