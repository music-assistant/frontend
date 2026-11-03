import RadioDetails from "@/views/RadioDetails.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { LoadDataParams } from "@/components/ItemsListing.vue";
import {
  EventType,
  ListingType,
  SortDirection,
  SortField,
  type Radio,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { radio } from "../fixtures/radio";
import { track } from "../fixtures/track";
import { providerMapping } from "../fixtures/providerMapping";

const {
  mockGetRadio,
  mockGetRadioVersions,
  mockSubscribe,
  mockStore,
  mockSetUserPreference,
} = vi.hoisted(() => ({
  mockGetRadio: vi.fn<MusicAssistantApi["getRadio"]>(),
  mockGetRadioVersions: vi.fn<MusicAssistantApi["getRadioVersions"]>(),
  mockSubscribe: vi.fn<MusicAssistantApi["subscribe"]>(() => () => {}),
  mockStore: {
    currentUser: null as {
      user_id?: string;
      preferences?: Record<string, unknown>;
    } | null,
  },
  mockSetUserPreference: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    getRadio: mockGetRadio,
    getRadioVersions: mockGetRadioVersions,
    subscribe: mockSubscribe,
  },
}));
vi.mock("@/plugins/store", () => ({ store: mockStore }));
vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: mockSetUserPreference,
}));
vi.mock("@/components/radio/RadioHero.vue", () => ({
  default: {
    name: "RadioHero",
    props: ["item"],
    emits: ["edit-rows"],
    template: "<div data-hero />",
  },
}));
vi.mock("@/components/details/DetailAdminCard.vue", () => ({
  default: {
    name: "DetailAdminCard",
    template: '<div data-row="provider_mappings" />',
  },
}));
vi.mock("@/components/details/DetailTextRow.vue", () => ({
  default: {
    name: "DetailTextRow",
    props: ["text"],
    emits: ["edit-rows"],
    template: '<div data-row="description" :data-text="text" />',
  },
}));
vi.mock("@/components/ProviderDetails.vue", () => ({
  default: { name: "ProviderDetails", template: "<div />" },
}));
vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["loadPagedData", "sortListing"],
    template: '<div data-row="other_versions" />',
  },
}));
vi.mock("@/components/DynamicItemSample.vue", () => ({
  default: {
    name: "DynamicItemSample",
    props: ["itemDetails", "provider"],
    template: '<div data-row="track_sample" />',
  },
}));
vi.mock("@/components/details/RowsEditor.vue", () => ({
  default: {
    name: "RowsEditor",
    props: ["open", "item", "registry", "availableIds", "subtitle"],
    emits: ["update:open"],
    template: "<div data-rows-editor />",
  },
}));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

enableAutoUnmount(afterEach);
afterEach(() => vi.useRealTimers());

const BASE_RADIO = radio({
  item_id: "radio-1",
  provider: "library",
  metadata: { description: "About the station" },
});

async function mountDetails(item: Radio = BASE_RADIO) {
  mockGetRadio.mockResolvedValue(item);
  const wrapper = mount(RadioDetails, {
    props: { itemId: item.item_id, provider: item.provider },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

function renderedRows(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll("[data-row]").map((row) => row.attributes("data-row"));
}

describe("RadioDetails", () => {
  beforeEach(() => {
    mockGetRadio.mockReset();
    mockGetRadioVersions.mockReset().mockResolvedValue([]);
    mockSubscribe.mockReset().mockReturnValue(() => {});
    mockStore.currentUser = { preferences: {} };
    mockSetUserPreference.mockReset();
  });

  it("renders description, radio content and provider details in the default order", async () => {
    const wrapper = await mountDetails();

    expect(renderedRows(wrapper)).toEqual([
      "description",
      "other_versions",
      "provider_mappings",
    ]);
    expect(wrapper.findComponent({ name: "DetailTextRow" }).props("text")).toBe(
      "About the station",
    );
  });

  it("shows a dynamic sample instead of other versions for a dynamic station", async () => {
    const wrapper = await mountDetails(radio({ is_dynamic: true }));

    expect(renderedRows(wrapper)).toEqual([
      "track_sample",
      "provider_mappings",
    ]);
    expect(wrapper.findComponent({ name: "ItemsListing" }).exists()).toBe(
      false,
    );
  });

  it("shows the full tracklist for a finite static station", async () => {
    const wrapper = await mountDetails(
      radio({ is_dynamic: false, is_endless: false }),
    );

    expect(renderedRows(wrapper)).toEqual([
      "track_sample",
      "provider_mappings",
    ]);
  });

  it.each([{ is_dynamic: true }, { is_dynamic: false, is_endless: false }])(
    "keeps the sample ID and provider paired after a mapped library update (%j)",
    async (stationType) => {
      vi.useFakeTimers();
      const station = radio({
        item_id: "provider-radio",
        provider: "radio-provider",
        ...stationType,
      });
      const libraryStation = radio({
        item_id: "42",
        provider: "library",
        provider_mappings: [
          providerMapping({
            item_id: station.item_id,
            provider_instance: station.provider,
            provider_domain: "radiobrowser",
            available: true,
          }),
        ],
        ...stationType,
      });
      const wrapper = await mountDetails(station);
      const sample = wrapper.findComponent({ name: "DynamicItemSample" });
      expect(sample.props("provider")).toBe(station.provider);

      const subscription = mockSubscribe.mock.calls.find(
        ([event]) => event === EventType.MEDIA_ITEM_UPDATED,
      );
      expect(subscription).toBeDefined();
      subscription![1]({
        event: EventType.MEDIA_ITEM_UPDATED,
        object_id: libraryStation.uri,
        data: libraryStation,
      });
      await vi.advanceTimersByTimeAsync(2000);
      await flushPromises();

      expect(sample.props("itemDetails").item_id).toBe(libraryStation.item_id);
      expect(sample.props("provider")).toBe(libraryStation.provider);
    },
  );

  it("shows other versions when a static station has no finite-station flag", async () => {
    const wrapper = await mountDetails(
      radio({ is_dynamic: false, is_endless: undefined }),
    );

    expect(renderedRows(wrapper)).toEqual([
      "other_versions",
      "provider_mappings",
    ]);
  });

  it("ignores a track update with the same provider mapping as the radio", async () => {
    vi.useFakeTimers();
    const station = radio({
      item_id: "https://example.com/stream",
      provider: "builtin",
      is_dynamic: true,
    });

    const wrapper = await mountDetails(station);
    const subscription = mockSubscribe.mock.calls.find(
      ([event]) => event === EventType.MEDIA_ITEM_UPDATED,
    );
    const libraryTrack = track({
      provider_mappings: [
        providerMapping({
          item_id: station.item_id,
          provider_instance: station.provider,
          provider_domain: station.provider,
        }),
      ],
    });
    expect(subscription).toBeDefined();
    subscription![1]({
      event: EventType.MEDIA_ITEM_UPDATED,
      object_id: libraryTrack.uri,
      data: libraryTrack,
    });
    await vi.advanceTimersByTimeAsync(2000);
    await flushPromises();

    expect(wrapper.findComponent({ name: "RadioHero" }).props("item")).toEqual(
      station,
    );
    expect(
      wrapper.findComponent({ name: "DynamicItemSample" }).props("itemDetails"),
    ).toEqual(station);
  });

  it.each([true, false, null])(
    "keeps newer radio metadata and reconciles the loaded favorite (%s)",
    async (favorite) => {
      vi.useFakeTimers();
      const station = radio({
        item_id: "provider-radio",
        provider: "radio-provider",
        is_dynamic: true,
        favorite,
      });
      const libraryStation = radio({
        item_id: "42",
        is_dynamic: true,
        provider_mappings: [
          providerMapping({
            item_id: station.item_id,
            provider_instance: station.provider,
          }),
        ],
      });
      const pending = Promise.withResolvers<Radio>();
      mockGetRadio.mockReturnValue(pending.promise);
      const wrapper = mount(RadioDetails, {
        props: { itemId: station.item_id, provider: station.provider },
        global: { mocks: { $t: (key: string) => key } },
      });
      const subscription = mockSubscribe.mock.calls.find(
        ([event]) => event === EventType.MEDIA_ITEM_UPDATED,
      );
      expect(subscription).toBeDefined();
      subscription![1]({
        event: EventType.MEDIA_ITEM_UPDATED,
        object_id: libraryStation.uri,
        data: libraryStation,
      });
      await vi.advanceTimersByTimeAsync(2000);
      await flushPromises();
      expect(
        wrapper.findComponent({ name: "RadioHero" }).props("item"),
      ).toEqual(libraryStation);

      pending.resolve(station);
      await flushPromises();

      expect(
        wrapper.findComponent({ name: "RadioHero" }).props("item"),
      ).toEqual({ ...libraryStation, favorite });
    },
  );

  it.each([
    { favorite: true, ownEvent: false },
    { favorite: false, ownEvent: false },
    { favorite: null, ownEvent: false },
    { favorite: null, ownEvent: true },
    { favorite: true, ownEvent: true },
    { favorite: false, ownEvent: true },
  ])(
    "keeps a later own favorite change (%j) when the response arrives",
    async ({ favorite, ownEvent }) => {
      vi.useFakeTimers();
      mockStore.currentUser = { user_id: "me", preferences: {} };
      const station = radio({
        provider: "builtin",
        item_id: "stream",
        favorite: true,
      });
      const updated = radio({
        item_id: "42",
        name: "New metadata",
        favorite: null,
        provider_mappings: [
          providerMapping({
            item_id: station.item_id,
            provider_instance: station.provider,
          }),
        ],
      });
      const pending = Promise.withResolvers<Radio>();
      mockGetRadio.mockReturnValue(pending.promise);
      const wrapper = mount(RadioDetails, {
        props: { itemId: station.item_id, provider: station.provider },
        global: { mocks: { $t: (key: string) => key } },
      });
      const itemSubscription = mockSubscribe.mock.calls.find(
        ([event]) => event === EventType.MEDIA_ITEM_UPDATED,
      )!;
      itemSubscription[1]({
        event: EventType.MEDIA_ITEM_UPDATED,
        data: updated,
      });
      await vi.advanceTimersByTimeAsync(2000);
      await flushPromises();

      if (ownEvent) {
        const favoriteSubscription = mockSubscribe.mock.calls.find(
          ([event]) => event === EventType.FAVORITE_UPDATED,
        )!;
        favoriteSubscription[1]({
          event: EventType.FAVORITE_UPDATED,
          data: { uri: updated.uri, user_id: "me", favorite },
        });
      } else {
        if (favorite === null) {
          wrapper.findComponent({ name: "RadioHero" }).props("item").favorite =
            true;
        }
        wrapper.findComponent({ name: "RadioHero" }).props("item").favorite =
          favorite;
      }
      pending.resolve(station);
      await flushPromises();

      expect(
        wrapper.findComponent({ name: "RadioHero" }).props("item"),
      ).toEqual({ ...updated, favorite });
    },
  );

  it("does not merge a previous route's favorite into the current radio", async () => {
    const previous = radio({ item_id: "previous", favorite: true });
    const current = radio({ item_id: "current", favorite: false });
    const pending = Promise.withResolvers<Radio>();
    mockGetRadio
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(current);
    const wrapper = mount(RadioDetails, {
      props: { itemId: previous.item_id, provider: previous.provider },
      global: { mocks: { $t: (key: string) => key } },
    });

    await wrapper.setProps({ itemId: current.item_id });
    await flushPromises();
    pending.resolve(previous);
    await flushPromises();

    expect(wrapper.findComponent({ name: "RadioHero" }).props("item")).toEqual(
      current,
    );
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

  it("follows saved row order and visibility", async () => {
    mockStore.currentUser = {
      preferences: {
        "radio.rows": {
          order: ["provider_mappings", "other_versions", "description"],
          hidden: ["description"],
        },
      },
    };

    const wrapper = await mountDetails();

    expect(renderedRows(wrapper)).toEqual([
      "provider_mappings",
      "other_versions",
    ]);
  });

  it("opens the rows editor from the hero and description row", async () => {
    const wrapper = await mountDetails();
    const editor = wrapper.findComponent({ name: "RowsEditor" });

    expect(editor.props("open")).toBe(false);
    wrapper.findComponent({ name: "RadioHero" }).vm.$emit("edit-rows");
    await flushPromises();
    expect(editor.props("open")).toBe(true);

    editor.vm.$emit("update:open", false);
    wrapper.findComponent({ name: "DetailTextRow" }).vm.$emit("edit-rows");
    await flushPromises();
    expect(editor.props("open")).toBe(true);
  });

  it("gives the editor the current station rows and radio-wide preference label", async () => {
    const wrapper = await mountDetails(radio({ is_dynamic: true }));
    const editor = wrapper.findComponent({ name: "RowsEditor" });

    expect(editor.props("availableIds")).toEqual([
      "description",
      "dynamic_sample",
      "provider_mappings",
    ]);
    expect(editor.props("subtitle")).toBe("Applies to every radio page");
  });

  it("uses copyright when the station has no description", async () => {
    const wrapper = await mountDetails(
      radio({ metadata: { copyright: "Station copyright" } }),
    );

    expect(wrapper.findComponent({ name: "DetailTextRow" }).props("text")).toBe(
      "Station copyright",
    );
  });
});
