import RadioDetails from "@/views/RadioDetails.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { LoadDataParams } from "@/components/ItemsListing.vue";
import {
  ListingType,
  SortDirection,
  SortField,
  type Radio,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { radio } from "../fixtures/radio";

const { mockGetRadio, mockGetRadioVersions, mockSubscribe } = vi.hoisted(
  () => ({
    mockGetRadio: vi.fn<MusicAssistantApi["getRadio"]>(),
    mockGetRadioVersions: vi.fn<MusicAssistantApi["getRadioVersions"]>(),
    mockSubscribe: vi.fn(() => () => {}),
  }),
);

vi.mock("@/plugins/api", () => ({
  api: {
    getRadio: mockGetRadio,
    getRadioVersions: mockGetRadioVersions,
    subscribe: mockSubscribe,
  },
}));

vi.mock("@/components/InfoHeader.vue", () => ({
  default: { name: "InfoHeader", template: "<div />" },
}));
// stubs identify which branch RadioDetails picked; their own machinery
// (router, auth, i18n composables) is irrelevant to that choice
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["loadPagedData", "sortListing"],
    template: '<div class="items-listing-stub" />',
  },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: { name: "ProviderDetails", template: "<div />" },
}));
vi.mock("@/components/DynamicItemSample.vue", () => ({
  default: {
    name: "DynamicItemSample",
    template: '<div class="dynamic-item-sample-stub" />',
  },
}));

async function mountDetails(item: Radio) {
  mockGetRadio.mockResolvedValue(item);
  const wrapper = mount(RadioDetails, {
    props: { itemId: item.item_id, provider: item.provider },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

describe("RadioDetails", () => {
  beforeEach(() => {
    mockGetRadio.mockReset();
    mockGetRadioVersions.mockReset().mockResolvedValue([]);
    mockSubscribe.mockReset().mockReturnValue(() => {});
  });

  it("shows the dynamic sample for a dynamic station", async () => {
    const wrapper = await mountDetails(radio({ is_dynamic: true }));

    expect(wrapper.find(".dynamic-item-sample-stub").exists()).toBe(true);
    expect(wrapper.find(".items-listing-stub").exists()).toBe(false);
  });

  it("shows other versions for a non-dynamic station", async () => {
    const wrapper = await mountDetails(radio({ is_dynamic: false }));

    expect(wrapper.find(".items-listing-stub").exists()).toBe(true);
    expect(wrapper.find(".dynamic-item-sample-stub").exists()).toBe(false);
  });

  it("loads radio versions with server search, sort and paging", async () => {
    const item = radio({ is_dynamic: false });
    const wrapper = await mountDetails(item);
    const listing = wrapper.findComponent({ name: "ItemsListing" });
    const params: LoadDataParams = {
      offset: 40,
      limit: 20,
      sortBy: "provider:asc",
      sortField: SortField.PROVIDER,
      sortDirection: SortDirection.ASC,
      search: "jazz",
    };

    await listing.props("loadPagedData")(params);

    expect(listing.props("sortListing")).toBe(ListingType.VERSIONS);
    expect(mockGetRadioVersions).toHaveBeenCalledWith(
      item.item_id,
      item.provider,
      "jazz",
      20,
      40,
      SortField.PROVIDER,
      SortDirection.ASC,
    );
  });

  it("shows the tracklist for a finite station", async () => {
    const wrapper = await mountDetails(radio({ is_endless: false }));

    expect(wrapper.find(".dynamic-item-sample-stub").exists()).toBe(true);
    expect(wrapper.find(".items-listing-stub").exists()).toBe(false);
  });

  it("shows other versions for a station that does not report is_endless", async () => {
    const wrapper = await mountDetails(
      radio({ is_dynamic: false, is_endless: undefined }),
    );

    expect(wrapper.find(".items-listing-stub").exists()).toBe(true);
    expect(wrapper.find(".dynamic-item-sample-stub").exists()).toBe(false);
  });
});
