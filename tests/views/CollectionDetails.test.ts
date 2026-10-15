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
  default: { name: "InfoHeader", template: "<div />" },
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
    };

    await (
      listing.props("loadPagedData") as (
        params: LoadDataParams,
      ) => Promise<unknown[]>
    )(params);

    expect(getAudiobookCollection).toHaveBeenCalledWith(
      "audiobook___Test Collection",
      "chapter",
      20,
      40,
    );
    expect(listing.props("parentItem")).toMatchObject({
      item_id: "audiobook___Test Collection",
    });
  });
});
