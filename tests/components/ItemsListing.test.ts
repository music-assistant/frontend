import ItemsListing from "@/components/ItemsListing.vue";
import { api, type MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type Album,
  type EventMessage,
  type ProviderInstance,
  type Track,
} from "@/plugins/api/interfaces";
import {
  eventbus,
  type DeleteConfirmationDialogEvent,
} from "@/plugins/eventbus";
import { store as storeModule } from "@/plugins/store";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { artist } from "../fixtures/artist";
import { genre } from "../fixtures/genre";
import { track } from "../fixtures/track";
import { user } from "../fixtures/user";

// Tracks live subscriptions the way the api does, so one that outlives the
// listing stays listed here.
const events = vi.hoisted(() => {
  const listeners: unknown[] = [];
  const listen = (handler: unknown) => {
    listeners.push(handler);
    return () => {
      const index = listeners.indexOf(handler);
      if (index !== -1) listeners.splice(index, 1);
    };
  };
  return {
    listeners,
    subscribe: (_type: unknown, handler: unknown) => listen(handler),
    subscribeMulti: (_types: unknown, handler: unknown) => listen(handler),
  };
});

const mockGetLibraryGenres = vi.hoisted(() =>
  vi.fn<MusicAssistantApi["getLibraryGenres"]>(),
);
const mockSubscribeMulti = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn());

vi.mock("@/plugins/api", () => {
  const api = {
    providers: {},
    providerManifests: {},
    getLibraryGenres: mockGetLibraryGenres,
    subscribe_multi: mockSubscribeMulti,
    subscribe: mockSubscribe,
  };
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await import("vue");
  return {
    store: reactive({
      dialogActive: false,
      showPlayersMenu: false,
      mobileLayout: false,
      activePlayer: undefined,
      activePlayerQueue: undefined,
      curQueueItem: undefined,
      currentUser: undefined,
      prevState: undefined,
    }),
  };
});

vi.mock("@/composables/userPreferences", async () => {
  const { computed } = await import("vue");
  return {
    useUserPreferences: () => ({
      getItemsListingPreferences: () => computed(() => ({})),
      setItemsListingPreference: vi.fn(),
    }),
  };
});

// helpers/utils transitively imports router/auth, which need a real browser
// environment; the listing only needs these two from it
vi.mock("@/helpers/utils", () => ({
  panelViewItemResponsive: () => 2,
  scrollElement: vi.fn(),
}));

vi.mock("@/helpers/media_item_actions", () => ({
  handleMenuBtnClick: vi.fn(),
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}));

// the search field reaches for the app-wide translator, which would otherwise
// build a real i18n instance off the mocked vue-i18n
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const stubComponent = vi.hoisted(() => (name: string) => ({
  default: { name, template: "<div />" },
}));

vi.mock("@/components/Toolbar.vue", () => ({
  default: {
    name: "Toolbar",
    props: ["menuItems"],
    // the append slot is where the desktop search field goes, beside the
    // button that opens it
    template:
      '<div class="toolbar-stub"><slot name="title" /><slot name="append" /></div>',
  },
}));
vi.mock("@/components/Container.vue", () => stubComponent("Container"));
vi.mock("@/components/icons/GenreIcon.vue", () => stubComponent("GenreIcon"));
vi.mock("@/components/skeletons/ListViewSkeleton.vue", () =>
  stubComponent("ListViewSkeleton"),
);
vi.mock("@/components/skeletons/PanelViewSkeleton.vue", () =>
  stubComponent("PanelViewSkeleton"),
);
vi.mock("@/components/ListviewItem.vue", () => stubComponent("ListviewItem"));
vi.mock("@/components/PanelviewItem.vue", () => stubComponent("PanelviewItem"));
vi.mock("@/components/PanelviewItemCompact.vue", () =>
  stubComponent("PanelviewItemCompact"),
);

// the real store computes these; on the mock they are plain writable state
const store = storeModule as typeof storeModule & { mobileLayout: boolean };

/**
 * Number of handlers the real eventbus currently holds for the listing's
 * selection event, so a handler registered after teardown is visible.
 */
function clearSelectionHandlers() {
  return eventbus.all.get("clearSelection")?.length ?? 0;
}

function mountListingRaw(
  props: Partial<InstanceType<typeof ItemsListing>["$props"]> = {},
) {
  return mount(ItemsListing, {
    props: {
      itemtype: "tracks",
      path: "librarytracks",
      showGenreFilter: true,
      loadPagedData: vi.fn().mockResolvedValue([]),
      ...props,
    },
    global: {
      mocks: {
        $t: (key: string) => key,
        $vuetify: { display: { width: 1280 } },
      },
      stubs: {
        // the search field's clear control is a Button, so it has to be real
        Empty: true,
        EmptyContent: true,
        EmptyDescription: true,
        EmptyHeader: true,
        EmptyTitle: true,
        Tabs: true,
        TabsList: true,
        TabsTrigger: true,
        "v-divider": true,
      },
    },
  });
}

enableAutoUnmount(afterEach);

describe("ItemsListing unmount cleanup", () => {
  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockImplementation(events.subscribeMulti);
    mockSubscribe.mockReset();
    mockSubscribe.mockImplementation(events.subscribe);
    store.prevState = undefined;
  });

  it("undoes everything it set up when the listing is closed", async () => {
    const listing = mountListingRaw();
    await flushPromises();

    expect(clearSelectionHandlers()).toBe(1);
    // the media item events and the user's own favorite changes
    expect(events.listeners).toHaveLength(2);

    listing.unmount();

    expect(clearSelectionHandlers()).toBe(0);
    expect(events.listeners).toHaveLength(0);
  });

  it("sets nothing up when the listing is closed while the genres are still loading", async () => {
    let resolveGenres: () => void = () => {};
    mockGetLibraryGenres.mockReturnValue(
      new Promise((resolve) => {
        resolveGenres = () => resolve([]);
      }),
    );
    const listing = mountListingRaw();
    // pin that the startup really is paused on the genres, so the assertions
    // below are about the resumed half and not about a startup that never ran
    expect(mockGetLibraryGenres).toHaveBeenCalled();

    listing.unmount();
    resolveGenres();
    await flushPromises();

    expect(clearSelectionHandlers()).toBe(0);
    expect(events.listeners).toHaveLength(0);
  });

  it("stops paging through the genres when the listing is closed mid-load", async () => {
    // a full page is what makes the loop ask for another one; taking the size
    // from the request keeps that true whatever page size the listing asks for
    let requestedPageSize = 0;
    let resolveFirstPage: () => void = () => {};
    mockGetLibraryGenres.mockImplementationOnce(({ limit } = {}) => {
      requestedPageSize = limit ?? 0;
      return new Promise((resolve) => {
        resolveFirstPage = () =>
          resolve(
            Array.from({ length: requestedPageSize }, (_, index) =>
              genre({ item_id: String(index), name: `Genre ${index}` }),
            ),
          );
      });
    });

    const listing = mountListingRaw();
    expect(mockGetLibraryGenres).toHaveBeenCalledTimes(1);
    // a page the listing never asked to fill would end the paging on its own,
    // leaving the assertion below true no matter what
    expect(requestedPageSize).toBeGreaterThan(0);

    listing.unmount();
    resolveFirstPage();
    await flushPromises();

    expect(mockGetLibraryGenres).toHaveBeenCalledTimes(1);
  });

  it("stops paging through the library when the listing is closed mid-selection", async () => {
    // a full page is what keeps the paging loop going; taking the size from the
    // request keeps that true whatever page size the listing asks for
    const fullPage = (limit: number) =>
      Array.from({ length: limit }, (_, index) =>
        track({ item_id: String(index), name: `Track ${index}` }),
      );
    let requestedPageSize = 0;
    let resolveHeldPage: () => void = () => {};
    const loadPagedData =
      vi.fn<(params: { limit: number }) => Promise<Track[]>>();
    loadPagedData
      // the load on mount, leaving more pages for the selection to page through
      .mockImplementationOnce(async ({ limit }) => fullPage(limit))
      // the first page the selection asks for, held open across the unmount
      .mockImplementationOnce(({ limit }) => {
        requestedPageSize = limit;
        return new Promise<Track[]>((resolve) => {
          resolveHeldPage = () => resolve(fullPage(limit));
        });
      })
      // a short page, so paging that carries on regardless still comes to an end
      .mockResolvedValue([]);

    const listing = mountListingRaw({ allowKeyHooks: true, loadPagedData });
    await flushPromises();
    expect(loadPagedData).toHaveBeenCalledTimes(1);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", ctrlKey: true }),
    );
    await flushPromises();
    // pin that selecting everything really is paused on a page request, so the
    // closing assertion is about the resumed loop and not one that never started
    expect(loadPagedData).toHaveBeenCalledTimes(2);
    // a page the listing never asked to fill would end the paging on its own,
    // leaving the closing assertion true no matter what
    expect(requestedPageSize).toBeGreaterThan(0);

    listing.unmount();
    resolveHeldPage();
    await flushPromises();

    expect(loadPagedData).toHaveBeenCalledTimes(2);
  });

  it("leaves a second listing on the page still clearing its own selection", async () => {
    const first = mountListingRaw();
    const second = mountListingRaw();
    await flushPromises();
    expect(clearSelectionHandlers()).toBe(2);

    // put the listing that stays into selection mode, so its reaction to the
    // event below is something to see
    const survivor = second.vm as unknown as { showCheckboxes: boolean };
    survivor.showCheckboxes = true;
    // a write that never landed would leave the closing assertion true anyway
    expect(survivor.showCheckboxes).toBe(true);

    first.unmount();
    eventbus.emit("clearSelection");

    expect(clearSelectionHandlers()).toBe(1);
    expect(survivor.showCheckboxes).toBe(false);
  });
});

describe("ItemsListing per-page search", () => {
  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockImplementation(events.subscribeMulti);
    mockSubscribe.mockReset();
    mockSubscribe.mockImplementation(events.subscribe);
    store.prevState = undefined;
    store.mobileLayout = false;
  });

  // the one button, which is a magnifier until the field is open and a close
  // cross after that
  const SEARCH_BUTTON_LABELS = [
    "tooltip.search",
    "tooltip.search_filter_active",
    "close",
  ];

  /** Clicks the magnifier in the toolbar, which is what opens the field. */
  async function toggleSearch(listing: ReturnType<typeof mountListingRaw>) {
    const items = listing
      .findComponent({ name: "Toolbar" })
      .props("menuItems") as { label?: string; action?: () => void }[];
    const search = items.find(
      (item) => item.label && SEARCH_BUTTON_LABELS.includes(item.label),
    );
    expect(search, "the toolbar offers a search toggle").toBeDefined();
    search!.action?.();
    await flushPromises();
  }

  function searchField(listing: ReturnType<typeof mountListingRaw>) {
    return listing.find(".search-field");
  }

  function searchButton(listing: ReturnType<typeof mountListingRaw>) {
    const items = listing
      .findComponent({ name: "Toolbar" })
      .props("menuItems") as { label?: string }[];
    return items.find(
      (item) => item.label && SEARCH_BUTTON_LABELS.includes(item.label),
    );
  }

  it("opens the field from the toolbar and closes it again", async () => {
    const listing = mountListingRaw({ showSearchButton: true });
    await flushPromises();
    expect(searchField(listing).exists()).toBe(false);

    await toggleSearch(listing);
    expect(searchField(listing).exists()).toBe(true);

    await toggleSearch(listing);
    expect(searchField(listing).exists()).toBe(false);
  });

  // the field opens into the slot the magnifier holds, so that button has to
  // become the way back out rather than staying a toggle nothing points at
  it("turns the toolbar magnifier into the close control while open", async () => {
    const listing = mountListingRaw({ showSearchButton: true });
    await flushPromises();

    expect(searchButton(listing)?.label).toBe("tooltip.search");

    await toggleSearch(listing);
    expect(searchButton(listing)?.label).toBe("close");

    await toggleSearch(listing);
    expect(searchButton(listing)?.label).toBe("tooltip.search");

    listing.unmount();
  });

  // on mobile the field is a row of its own with its own close button, so the
  // toolbar one stays a plain toggle
  it("leaves the mobile toolbar button a magnifier", async () => {
    store.mobileLayout = true;
    const mobile = mountListingRaw({ showSearchButton: true });
    await flushPromises();
    await toggleSearch(mobile);

    expect(searchButton(mobile)?.label).toBe("tooltip.search");
    expect(mobile.find(".listing-search--row").exists()).toBe(true);

    mobile.unmount();
  });

  it("only offers the clear button once there is a term", async () => {
    const listing = mountListingRaw({ showSearchButton: true });
    await flushPromises();
    await toggleSearch(listing);

    expect(listing.find('.search-field button[type="button"]').exists()).toBe(
      false,
    );

    await listing.get(".search-field input").setValue("hello");
    expect(listing.find('.search-field button[type="button"]').exists()).toBe(
      true,
    );

    listing.unmount();
  });

  it("names the listing it searches in its placeholder", async () => {
    const listing = mountListingRaw({
      itemtype: "artists",
      showSearchButton: true,
    });
    await flushPromises();
    await toggleSearch(listing);

    expect(listing.get(".search-field input").attributes("placeholder")).toBe(
      "search_in",
    );
  });

  // a desktop toolbar has room for the field, a phone toolbar does not
  it("puts the field in the toolbar on desktop and on its own row on mobile", async () => {
    const listing = mountListingRaw({
      showSearchButton: true,
      title: "Tracks",
    });
    await flushPromises();
    await toggleSearch(listing);

    expect(listing.find(".toolbar-stub .search-field").exists()).toBe(true);
    expect(listing.find(".listing-search--row").exists()).toBe(false);
    // and it sits beside the title rather than in place of it
    expect(listing.find(".toolbar-stub").text()).toContain("Tracks");

    listing.unmount();
    store.mobileLayout = true;
    const mobile = mountListingRaw({ showSearchButton: true });
    await flushPromises();
    await toggleSearch(mobile);

    expect(mobile.find(".toolbar-stub .search-field").exists()).toBe(false);
    expect(mobile.find(".listing-search--row").exists()).toBe(true);
  });

  // the X used to close the field along with the term, which took the search
  // away from under someone who only wanted to retype
  it("clears the term from the X without closing the field", async () => {
    const listing = mountListingRaw({ showSearchButton: true });
    await flushPromises();
    await toggleSearch(listing);
    await listing.get(".search-field input").setValue("hello");

    await listing.get('.search-field button[type="button"]').trigger("click");
    await flushPromises();

    expect(searchField(listing).exists()).toBe(true);
    expect(
      (listing.get(".search-field input").element as HTMLInputElement).value,
    ).toBe("");
  });

  it("drops the term when the field is closed", async () => {
    const listing = mountListingRaw({ showSearchButton: true });
    await flushPromises();
    await toggleSearch(listing);

    await listing.get(".search-field input").setValue("hello");
    await toggleSearch(listing);
    await toggleSearch(listing);

    expect(
      (listing.get(".search-field input").element as HTMLInputElement).value,
    ).toBe("");
  });
});

describe("ItemsListing select all", () => {
  const nativeConfirm = vi.fn();

  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockImplementation(events.subscribeMulti);
    mockSubscribe.mockReset();
    mockSubscribe.mockImplementation(events.subscribe);
    store.prevState = undefined;
    store.mobileLayout = false;
    nativeConfirm.mockReset();
    // the test environment has no window.confirm, so a native popup would throw
    // here; the stub turns that into a readable assertion instead
    vi.stubGlobal("confirm", nativeConfirm);
    vi.spyOn(eventbus, "emit");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(eventbus.emit).mockRestore();
  });

  it("selects a small listing without asking", async () => {
    const listing = await selectAll(3);

    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(confirmationRequest()).toBeUndefined();
    expect(selection(listing)).toHaveLength(1);
  });

  it("asks first when the listing is large enough to be a misclick", async () => {
    const listing = await selectAll(500);
    const request = confirmationRequest();

    expect(nativeConfirm).not.toHaveBeenCalled();
    expect(request?.message).toBe("select_all_confirmation");
    // selecting items destroys nothing, so the red button would be a lie
    expect(request?.destructive).toBe(false);
    expect(selection(listing)).toHaveLength(0);

    await request?.onConfirm();
    await flushPromises();

    expect(selection(listing)).toHaveLength(1);
  });
});

describe("ItemsListing source selector", () => {
  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockImplementation(events.subscribeMulti);
    mockSubscribe.mockReset();
    mockSubscribe.mockImplementation(events.subscribe);
    store.prevState = undefined;
    for (const key of Object.keys(api.providers)) delete api.providers[key];
    api.providers["spotify--1"] = {
      instance_id: "spotify--1",
      name: "Spotify",
      domain: "spotify",
    } as ProviderInstance;
  });

  /** Mounts a listing whose items come from the library or from one provider. */
  function mountSourceListing(
    props: Partial<InstanceType<typeof ItemsListing>["$props"]> = {},
  ) {
    const loadItems = vi.fn().mockResolvedValue([]);
    const listing = mountListingRaw({
      itemtype: "artistalbums",
      path: "artistalbums",
      loadPagedData: undefined,
      loadItems,
      providerFilterOptions: ["spotify--1"],
      requireProviderSelection: true,
      libraryFilterOption: true,
      ...props,
    });
    return { listing, loadItems };
  }

  function sourceOptions(listing: ReturnType<typeof mountListingRaw>) {
    const items = listing
      .findComponent({ name: "Toolbar" })
      .props("menuItems") as {
      label?: string;
      subItems?: { label?: string; selected?: boolean; action?: () => void }[];
    }[];
    return items.find((item) => item.label === "tooltip.select_provider")
      ?.subItems;
  }

  it("offers the library beside the providers, and starts there", async () => {
    const { listing, loadItems } = mountSourceListing();
    await flushPromises();

    expect(sourceOptions(listing)?.map((option) => option.label)).toEqual([
      "source_library",
      "Spotify",
    ]);
    expect(sourceOptions(listing)?.[0].selected).toBe(true);
    expect(loadItems).toHaveBeenCalledWith(
      expect.objectContaining({ provider: ["library"] }),
    );
  });

  it("starts on the source the page asked for", async () => {
    const { listing, loadItems } = mountSourceListing({
      defaultProvider: "spotify--1",
    });
    await flushPromises();

    expect(sourceOptions(listing)?.[1].selected).toBe(true);
    expect(loadItems).toHaveBeenCalledWith(
      expect.objectContaining({ provider: ["spotify--1"] }),
    );
  });

  it("reloads from the source that is picked", async () => {
    const { listing, loadItems } = mountSourceListing();
    await flushPromises();
    loadItems.mockClear();

    sourceOptions(listing)?.[1].action?.();
    await flushPromises();

    expect(loadItems).toHaveBeenCalledWith(
      expect.objectContaining({ provider: ["spotify--1"] }),
    );
    expect(sourceOptions(listing)?.[1].selected).toBe(true);
  });

  it("leaves the library out when the page does not offer it", async () => {
    api.providers["tidal--1"] = {
      instance_id: "tidal--1",
      name: "Tidal",
      domain: "tidal",
    } as ProviderInstance;
    const { listing } = mountSourceListing({
      libraryFilterOption: false,
      providerFilterOptions: ["spotify--1", "tidal--1"],
    });
    await flushPromises();

    expect(sourceOptions(listing)?.map((option) => option.label)).toEqual([
      "Spotify",
      "Tidal",
    ]);
  });
});

describe("ItemsListing favorite updates", () => {
  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockImplementation(events.subscribeMulti);
    mockSubscribe.mockReset();
    mockSubscribe.mockImplementation(events.subscribe);
    store.prevState = undefined;
    // the event only reaches the screen when it belongs to the signed-in user
    store.currentUser = user();
  });

  afterEach(() => {
    store.currentUser = undefined;
  });

  /** The handler the listing registered for the user's own favorite changes. */
  function favoriteUpdateHandler() {
    const call = mockSubscribe.mock.calls.find(
      ([type]) => type === EventType.FAVORITE_UPDATED,
    );
    expect(call, "the listing listens for the favorite updates").toBeDefined();
    return call![1] as (evt: EventMessage) => void;
  }

  // a playlist can list the same track twice, and both rows show the state
  it("shows the state on every row that holds the item", async () => {
    const listing = mountListingRaw({
      loadPagedData: vi
        .fn()
        .mockResolvedValue([
          track({ item_id: "1", position: 0 }),
          track({ item_id: "1", position: 1 }),
          track({ item_id: "2" }),
        ]),
    });
    await flushPromises();

    favoriteUpdateHandler()({
      event: EventType.FAVORITE_UPDATED,
      object_id: "library://track/1",
      data: {
        uri: "library://track/1",
        media_type: MediaType.TRACK,
        item_id: "1",
        favorite: true,
        user_id: user().user_id,
      },
    } as EventMessage);

    expect(rows(listing).map((item) => item.favorite)).toEqual([
      true,
      true,
      false,
    ]);
  });
});

describe("ItemsListing empty-state source shortcuts", () => {
  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockImplementation(events.subscribeMulti);
    store.prevState = undefined;
    for (const key of Object.keys(api.providers)) delete api.providers[key];
    api.providers["spotify--1"] = {
      instance_id: "spotify--1",
      name: "Spotify",
      domain: "spotify",
    } as ProviderInstance;
  });

  /** Mounts an empty library-scoped listing with its empty state rendered. */
  function mountEmptyListing(
    props: Partial<InstanceType<typeof ItemsListing>["$props"]> = {},
  ) {
    const loadItems = vi.fn().mockResolvedValue([]);
    const listing = mount(ItemsListing, {
      props: {
        itemtype: "artistalbums",
        path: "artistalbums",
        loadItems,
        providerFilterOptions: ["spotify--1"],
        requireProviderSelection: true,
        libraryFilterOption: true,
        ...props,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
          $vuetify: { display: { width: 1280 } },
        },
        stubs: {
          // the shared Container stub drops its slot; render it so the empty
          // state inside it shows, while the list/snackbar chrome stays stubbed
          Container: { template: "<div><slot /></div>" },
          "v-infinite-scroll": true,
          "v-virtual-scroll": true,
          "v-snackbar": true,
          Tabs: true,
          TabsList: true,
          TabsTrigger: true,
          "v-divider": true,
        },
      },
    });
    return { listing, loadItems };
  }

  function shortcut(listing: ReturnType<typeof mountEmptyListing>["listing"]) {
    return listing
      .findAll("button")
      .find((button) => button.text().includes("show_results_on"));
  }

  it("offers a provider shortcut when the empty listing is on the library", async () => {
    const { listing } = mountEmptyListing();
    await flushPromises();

    expect(shortcut(listing)).toBeDefined();
  });

  it("switches the filter to that provider when the shortcut is used", async () => {
    const { listing, loadItems } = mountEmptyListing();
    await flushPromises();
    loadItems.mockClear();

    await shortcut(listing)!.trigger("click");
    await flushPromises();

    expect(loadItems).toHaveBeenCalledWith(
      expect.objectContaining({ provider: ["spotify--1"] }),
    );
  });

  it("offers no shortcut once a provider source is selected", async () => {
    const { listing } = mountEmptyListing({ defaultProvider: "spotify--1" });
    await flushPromises();

    expect(shortcut(listing)).toBeUndefined();
  });

  it("offers no shortcut for a listing that does not offer the library", async () => {
    const { listing } = mountEmptyListing({
      itemtype: "tracks",
      path: "librarytracks",
      libraryFilterOption: false,
      requireProviderSelection: false,
      providerFilterOptions: undefined,
    });
    await flushPromises();

    expect(shortcut(listing)).toBeUndefined();
  });
});

describe("ItemsListing restore state", () => {
  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockImplementation(events.subscribeMulti);
    store.prevState = undefined;
  });

  type Props = InstanceType<typeof ItemsListing>["$props"];
  type LoadItemsFn = NonNullable<Props["loadItems"]>;

  /** Mounts an artist-albums listing whose items come from `loadItems`. */
  function mountArtistAlbums(
    parentItem: Props["parentItem"],
    loadItems: LoadItemsFn,
  ) {
    return mountListingRaw({
      itemtype: "artistalbums",
      path: "artistalbums",
      restoreState: true,
      parentItem,
      loadPagedData: undefined,
      loadItems,
    });
  }

  function shownItems(listing: ReturnType<typeof mountListingRaw>) {
    return (listing.vm as unknown as { pagedItems: { uri: string }[] })
      .pagedItems;
  }

  /** Loads and closes a listing so its items land in the restore cache. */
  async function cacheArtistAlbums(
    parentItem: Props["parentItem"],
    cached: Album[],
  ) {
    const first = mountArtistAlbums(
      parentItem,
      vi.fn<LoadItemsFn>().mockResolvedValue(cached),
    );
    await flushPromises();
    first.unmount();
  }

  it("restores the cached items when the same parent is reopened", async () => {
    const parent = artist({ item_id: "1" });
    const cached = album({ item_id: "a1" });
    await cacheArtistAlbums(parent, [cached]);

    const loadItems = vi.fn<LoadItemsFn>().mockResolvedValue([]);
    const listing = mountArtistAlbums(parent, loadItems);
    await flushPromises();

    // the previous albums are restored without hitting the loader again
    expect(loadItems).not.toHaveBeenCalled();
    expect(shownItems(listing).map((item) => item.uri)).toEqual([cached.uri]);
  });

  it("reloads instead of showing another artist's cached albums", async () => {
    await cacheArtistAlbums(artist({ item_id: "1" }), [
      album({ item_id: "a1" }),
    ]);

    const nextAlbum = album({ item_id: "a2" });
    const loadItems = vi.fn<LoadItemsFn>().mockResolvedValue([nextAlbum]);
    const listing = mountArtistAlbums(artist({ item_id: "2" }), loadItems);
    await flushPromises();

    // the shared "artistalbums" path must not carry the first artist's albums over
    expect(loadItems).toHaveBeenCalled();
    expect(shownItems(listing).map((item) => item.uri)).toEqual([
      nextAlbum.uri,
    ]);
  });

  it("restores a parentless listing (e.g. a library page)", async () => {
    const cached = album({ item_id: "a1" });
    await cacheArtistAlbums(undefined, [cached]);

    const loadItems = vi.fn<LoadItemsFn>().mockResolvedValue([]);
    const listing = mountArtistAlbums(undefined, loadItems);
    await flushPromises();

    // a listing with no parent still matches itself and restores its items
    expect(loadItems).not.toHaveBeenCalled();
    expect(shownItems(listing).map((item) => item.uri)).toEqual([cached.uri]);
  });
});

/** Mounts a listing of `total` items and asks it to select them all. */
async function selectAll(total: number) {
  const listing = mountListingRaw({
    allowKeyHooks: true,
    total,
    loadPagedData: vi.fn().mockResolvedValue([track({ item_id: "1" })]),
  });
  await flushPromises();

  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "a", ctrlKey: true }),
  );
  await flushPromises();
  return listing;
}

function selection(listing: ReturnType<typeof mountListingRaw>) {
  return (listing.vm as unknown as { selectedItems: Track[] }).selectedItems;
}

function rows(listing: ReturnType<typeof mountListingRaw>) {
  return (listing.vm as unknown as { pagedItems: Track[] }).pagedItems;
}

function confirmationRequest() {
  // the emitter types its payload per event, which a call list cannot express
  const calls = vi.mocked(eventbus.emit).mock.calls as unknown as [
    string,
    DeleteConfirmationDialogEvent,
  ][];
  return calls.find(([event]) => event === "deleteConfirmationDialog")?.[1];
}
