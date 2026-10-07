import ItemsListing from "@/components/ItemsListing.vue";
import LibrarySortControls from "@/components/LibrarySortControls.vue";
import { useEscapeBack } from "@/composables/useEscapeBack";
import { defineComponent, h } from "vue";
import { api, type MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  MediaType,
  SortDirection,
  SortField,
  type Album,
  type EventMessage,
  type ProviderInstance,
  type ProviderManifest,
  type SortOptionInfo,
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
const mockGetLibrarySortOptions = vi.hoisted(() => vi.fn());
const mockSubscribeMulti = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn());

vi.mock("@/plugins/api", () => {
  const api = {
    providers: {},
    providerManifests: {},
    getLibraryGenres: mockGetLibraryGenres,
    getLibrarySortOptions: mockGetLibrarySortOptions,
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

const mockSetItemsListingPreference = vi.hoisted(() => vi.fn());

// reads the saved listing settings off the signed-in user the way the real
// composable does, so a test can seed them and replace them to stand in for a
// save
vi.mock("@/composables/userPreferences", async () => {
  const { computed } = await import("vue");
  const { store } = await import("@/plugins/store");
  return {
    useUserPreferences: () => ({
      getItemsListingPreferences: (path: string, itemtype: string) =>
        computed(
          () =>
            store.currentUser?.preferences?.[
              `itemsListing.${path}.${itemtype}`
            ] ?? {},
        ),
      setItemsListingPreference: mockSetItemsListingPreference,
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

// how the listing was reached: an entry ahead means it was gone back to
const routerHistoryState = vi.hoisted(() => ({
  forward: null as string | null,
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({
    push: vi.fn(),
    options: { history: { state: routerHistoryState } },
  }),
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
// renders what it holds, so the grid inside it can be looked at
vi.mock("@/components/Container.vue", () => ({
  default: { name: "Container", template: "<div><slot /></div>" },
}));
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

/** Signs in a user who saved these settings for the artist-albums listing. */
function signInWithSavedSettings(settings: Record<string, unknown>) {
  store.currentUser = user({
    preferences: { "itemsListing.artistalbums.artistalbums": settings },
  });
}

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
    attachTo: document.body,
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
        // the grid's layout, as plain boxes that keep their column class
        VInfiniteScroll: { template: "<div><slot /></div>" },
        VRow: { template: "<div><slot /></div>" },
        VCol: { template: '<div class="grid-col"><slot /></div>' },
        VVirtualScroll: true,
        VSnackbar: true,
        VBtn: true,
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

  it.each(
    [true, false].flatMap((backFirst) =>
      [true, false].flatMap((focused) =>
        [true, undefined].map((allowKeyHooks) => ({
          backFirst,
          focused,
          allowKeyHooks,
        })),
      ),
    ),
  )(
    "dismisses search before back (back first: $backFirst, focused: $focused, hooks: $allowKeyHooks)",
    async ({ backFirst, focused, allowKeyHooks }) => {
      const back = vi.fn();
      const mountBack = () =>
        mount(
          defineComponent({
            setup() {
              useEscapeBack(back);
              return () => h("div");
            },
          }),
          // stubs are global in test-utils, so a mount after the listing's
          // sets the ones its re-renders get: keep its snackbar stubbed
          { global: { stubs: { "v-divider": true, VSnackbar: true } } },
        );
      if (backFirst) mountBack();
      const listing = mountListingRaw({
        allowKeyHooks,
        showSearchButton: true,
      });
      if (!backFirst) mountBack();
      await flushPromises();
      await toggleSearch(listing);
      const first = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      const input = listing.get(".search-field input")
        .element as HTMLInputElement;
      if (!focused) input.blur();
      (focused ? input : document.body).dispatchEvent(first);
      await flushPromises();
      expect(first.defaultPrevented).toBe(true);
      expect(searchField(listing).exists()).toBe(false);
      expect(back).not.toHaveBeenCalled();
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          bubbles: true,
          cancelable: true,
        }),
      );
      expect(back).toHaveBeenCalledOnce();
    },
  );

  it.each(["dialog", "players"])(
    "leaves search open when Escape belongs to %s",
    async (owner) => {
      const listing = mountListingRaw({ showSearchButton: true });
      await flushPromises();
      await toggleSearch(listing);
      const event = new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      });
      store.dialogActive = owner === "dialog";
      store.showPlayersMenu = owner === "players";
      try {
        document.body.dispatchEvent(event);
        await flushPromises();
        expect(searchField(listing).exists()).toBe(true);
        expect(event.defaultPrevented).toBe(false);
      } finally {
        store.dialogActive = false;
        store.showPlayersMenu = false;
      }
    },
  );

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

describe("ItemsListing cover size", () => {
  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockImplementation(events.subscribeMulti);
    store.prevState = undefined;
    store.currentUser = undefined;
    mockSetItemsListingPreference.mockClear();
  });

  afterEach(() => {
    store.currentUser = undefined;
  });

  /** Signs in a user who saved these settings for the albums grid. */
  function signInWithSavedGrid(settings: Record<string, unknown>) {
    store.currentUser = user({
      preferences: { "itemsListing.libraryalbums.albums": settings },
    });
  }

  /** An albums grid, whose window width alone would give it two columns. */
  async function mountGrid() {
    const listing = mountListingRaw({
      itemtype: "albums",
      path: "libraryalbums",
      showGenreFilter: false,
      loadPagedData: vi.fn().mockResolvedValue([album()]),
    });
    await flushPromises();
    return listing;
  }

  /** The column class the grid's first cover is laid out with. */
  function columns(listing: ReturnType<typeof mountListingRaw>) {
    return listing
      .get(".grid-col")
      .classes()
      .find((name) => /^col-\d+$/.test(name));
  }

  type SliderItem = {
    label?: string;
    hide?: boolean;
    componentProps?: {
      size: number;
      onChange: (size: number) => void;
      onCommit: (size: number) => void;
    };
  };

  function slider(listing: ReturnType<typeof mountListingRaw>) {
    const items = listing
      .findComponent({ name: "Toolbar" })
      .props("menuItems") as { subItems?: SliderItem[] }[];
    return items
      .flatMap((item) => item.subItems ?? [])
      .find((item) => item.label === "grid_size");
  }

  it("opens at the size the listing was left at", async () => {
    signInWithSavedGrid({ viewMode: "panel", gridSize: -2 });
    const listing = await mountGrid();

    expect(slider(listing)?.componentProps?.size).toBe(-2);
    expect(columns(listing)).toBe("col-4");
  });

  it("follows the slider while it moves, and saves only once let go", async () => {
    signInWithSavedGrid({ viewMode: "panel" });
    const listing = await mountGrid();
    expect(columns(listing)).toBe("col-2");

    slider(listing)?.componentProps?.onChange(-3);
    await flushPromises();

    expect(columns(listing)).toBe("col-5");
    expect(mockSetItemsListingPreference).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "gridSize",
      expect.anything(),
    );

    slider(listing)?.componentProps?.onCommit(-3);
    await flushPromises();

    expect(mockSetItemsListingPreference).toHaveBeenCalledWith(
      "libraryalbums",
      "albums",
      "gridSize",
      -3,
    );
  });

  it("leaves the slider out of the list view", async () => {
    signInWithSavedGrid({ viewMode: "list" });
    const listing = await mountGrid();

    expect(slider(listing)?.hide).toBe(true);
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
    store.currentUser = undefined;
    mockSetItemsListingPreference.mockClear();
    for (const key of Object.keys(api.providers)) delete api.providers[key];
    for (const key of Object.keys(api.providerManifests)) {
      delete api.providerManifests[key];
    }
    api.providers["spotify--1"] = {
      instance_id: "spotify--1",
      name: "Spotify",
      domain: "spotify",
    } as ProviderInstance;
    api.providers["tidal--1"] = {
      instance_id: "tidal--1",
      name: "Tidal",
      domain: "tidal",
    } as ProviderInstance;
  });

  /** Registers two accounts of one streaming service, each under its own name. */
  function addSpotifyAccounts() {
    api.providerManifests["spotify"] = { name: "Spotify" } as ProviderManifest;
    for (const [instanceId, name] of [
      ["spotify--1", "Spotify [marcelveldt2]"],
      ["spotify--2", "Spotify [marcelveldt3]"],
    ]) {
      api.providers[instanceId] = {
        instance_id: instanceId,
        name,
        domain: "spotify",
        is_streaming_provider: true,
      } as ProviderInstance;
    }
  }

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

  function selectedSource(listing: ReturnType<typeof mountListingRaw>) {
    return sourceOptions(listing)?.find((option) => option.selected)?.label;
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

  it("tells the page which source it is on", async () => {
    const { listing } = mountSourceListing();
    await flushPromises();

    expect(listing.emitted("provider-change")?.[0]).toEqual([["library"]]);

    sourceOptions(listing)?.[1].action?.();
    await flushPromises();

    expect(listing.emitted("provider-change")?.at(-1)).toEqual([
      ["spotify--1"],
    ]);
  });

  it("leaves the library out when the page does not offer it", async () => {
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

  it("names a streaming service offered once after the service", async () => {
    addSpotifyAccounts();
    const { listing } = mountSourceListing({
      providerFilterOptions: ["spotify--1"],
    });
    await flushPromises();

    expect(sourceOptions(listing)?.map((option) => option.label)).toEqual([
      "source_library",
      "Spotify",
    ]);
  });

  it("names the accounts of a streaming service offered side by side after themselves", async () => {
    addSpotifyAccounts();
    const { listing } = mountSourceListing({
      providerFilterOptions: ["spotify--1", "spotify--2"],
    });
    await flushPromises();

    expect(sourceOptions(listing)?.map((option) => option.label)).toEqual([
      "source_library",
      "Spotify [marcelveldt2]",
      "Spotify [marcelveldt3]",
    ]);
  });

  // a "view all" link can name the source its shelf was showing, and the
  // listing opens on it even when the user pinned another source here before
  it("opens on a source carried in by a link, over the saved filter", async () => {
    signInWithSavedSettings({ providerFilter: ["tidal--1"] });
    const { listing, loadItems } = mountSourceListing({
      providerFilterOptions: ["spotify--1", "tidal--1"],
      providerOverride: "spotify--1",
    });
    await flushPromises();

    expect(selectedSource(listing)).toBe("Spotify");
    // a single load, straight from the carried source
    expect(loadItems).toHaveBeenCalledTimes(1);
    expect(loadItems).toHaveBeenCalledWith(
      expect.objectContaining({ provider: ["spotify--1"] }),
    );
    // the pinned filter is the user's own and stays as it was
    expect(mockSetItemsListingPreference).not.toHaveBeenCalled();
  });

  it("stays on the carried source when another setting is saved", async () => {
    signInWithSavedSettings({ providerFilter: ["tidal--1"] });
    const { listing, loadItems } = mountSourceListing({
      providerFilterOptions: ["spotify--1", "tidal--1"],
      providerOverride: "spotify--1",
    });
    await flushPromises();
    loadItems.mockClear();

    // every save hands the listing its saved settings again, pinned filter
    // included
    signInWithSavedSettings({
      providerFilter: ["tidal--1"],
      viewMode: "list",
    });
    await flushPromises();

    expect(selectedSource(listing)).toBe("Spotify");
    expect(loadItems).not.toHaveBeenCalled();
  });

  it("hands over to the source the user picks", async () => {
    signInWithSavedSettings({ providerFilter: ["tidal--1"] });
    const { listing, loadItems } = mountSourceListing({
      providerFilterOptions: ["spotify--1", "tidal--1"],
      providerOverride: "spotify--1",
    });
    await flushPromises();

    sourceOptions(listing)
      ?.find((option) => option.label === "source_library")
      ?.action?.();
    await flushPromises();

    expect(mockSetItemsListingPreference).toHaveBeenCalledWith(
      "artistalbums",
      "artistalbums",
      "providerFilter",
      ["library"],
    );
    expect(loadItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ provider: ["library"] }),
    );

    // from here on the saved pick is what comes back, not the link's source
    signInWithSavedSettings({ providerFilter: ["library"] });
    await flushPromises();

    expect(selectedSource(listing)).toBe("source_library");
  });

  it("pins the carried source when the user picks it again", async () => {
    signInWithSavedSettings({ providerFilter: ["tidal--1"] });
    const { listing, loadItems } = mountSourceListing({
      providerFilterOptions: ["spotify--1", "tidal--1"],
      providerOverride: "spotify--1",
    });
    await flushPromises();
    loadItems.mockClear();

    sourceOptions(listing)
      ?.find((option) => option.label === "Spotify")
      ?.action?.();
    await flushPromises();

    expect(mockSetItemsListingPreference).toHaveBeenCalledWith(
      "artistalbums",
      "artistalbums",
      "providerFilter",
      ["spotify--1"],
    );
    // the albums on screen already come from it
    expect(loadItems).not.toHaveBeenCalled();
    expect(selectedSource(listing)).toBe("Spotify");
  });

  it("leaves a re-pick of the shown source alone when none was carried in", async () => {
    signInWithSavedSettings({ providerFilter: ["tidal--1"] });
    const { listing, loadItems } = mountSourceListing({
      providerFilterOptions: ["spotify--1", "tidal--1"],
    });
    await flushPromises();
    loadItems.mockClear();

    sourceOptions(listing)
      ?.find((option) => option.label === "Tidal")
      ?.action?.();
    await flushPromises();

    expect(mockSetItemsListingPreference).not.toHaveBeenCalled();
    expect(loadItems).not.toHaveBeenCalled();
  });

  it("keeps the saved filter when the carried source is not offered", async () => {
    signInWithSavedSettings({ providerFilter: ["tidal--1"] });
    const { listing } = mountSourceListing({
      providerFilterOptions: ["spotify--1", "tidal--1"],
      providerOverride: "deezer--1",
    });
    await flushPromises();

    expect(selectedSource(listing)).toBe("Tidal");

    // and re-picking the saved source stays a no-op
    sourceOptions(listing)
      ?.find((option) => option.label === "Tidal")
      ?.action?.();
    await flushPromises();

    expect(mockSetItemsListingPreference).not.toHaveBeenCalled();
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
      null,
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
    store.currentUser = undefined;
    routerHistoryState.forward = null;
    for (const key of Object.keys(api.providers)) delete api.providers[key];
    api.providers["spotify--1"] = {
      instance_id: "spotify--1",
      name: "Spotify",
      domain: "spotify",
    } as ProviderInstance;
    api.providers["tidal--1"] = {
      instance_id: "tidal--1",
      name: "Tidal",
      domain: "tidal",
    } as ProviderInstance;
  });

  type Props = InstanceType<typeof ItemsListing>["$props"];
  type LoadItemsFn = NonNullable<Props["loadItems"]>;

  // an artist's albums are listed from the library or from one provider
  const sourceSelection: Partial<Props> = {
    providerFilterOptions: ["spotify--1", "tidal--1"],
    requireProviderSelection: true,
    libraryFilterOption: true,
  };

  /** Mounts an artist-albums listing whose items come from `loadItems`. */
  function mountArtistAlbums(
    parentItem: Props["parentItem"],
    loadItems: LoadItemsFn,
    props: Partial<Props> = {},
  ) {
    return mountListingRaw({
      itemtype: "artistalbums",
      path: "artistalbums",
      restoreState: true,
      parentItem,
      loadPagedData: undefined,
      loadItems,
      ...props,
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
    props: Partial<Props> = {},
  ) {
    const first = mountArtistAlbums(
      parentItem,
      vi.fn<LoadItemsFn>().mockResolvedValue(cached),
      props,
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

  // a "view all" link that names a source outranks what the last visit to
  // this artist's albums left behind
  it("loads from a carried source instead of restoring another source's albums", async () => {
    const parent = artist({ item_id: "1" });
    await cacheArtistAlbums(parent, [album({ item_id: "a1" })], {
      ...sourceSelection,
      defaultProvider: "tidal--1",
    });

    const fromLink = album({ item_id: "a2" });
    const loadItems = vi.fn<LoadItemsFn>().mockResolvedValue([fromLink]);
    const listing = mountArtistAlbums(parent, loadItems, {
      ...sourceSelection,
      providerOverride: "spotify--1",
    });
    await flushPromises();

    expect(loadItems).toHaveBeenCalledWith(
      expect.objectContaining({ provider: ["spotify--1"] }),
    );
    expect(shownItems(listing).map((item) => item.uri)).toEqual([fromLink.uri]);
  });

  // a visit on a carried-in source is one to go back to, not one to land on
  // again from elsewhere: reached anew, the listing starts over on the saved
  // filter
  it("starts over on the saved filter when a carried visit is reached anew", async () => {
    signInWithSavedSettings({ providerFilter: ["tidal--1"] });
    const parent = artist({ item_id: "1" });
    await cacheArtistAlbums(parent, [album({ item_id: "a1" })], {
      ...sourceSelection,
      providerOverride: "spotify--1",
    });

    const pinned = album({ item_id: "a2" });
    const loadItems = vi.fn<LoadItemsFn>().mockResolvedValue([pinned]);
    const listing = mountArtistAlbums(parent, loadItems, sourceSelection);
    await flushPromises();

    expect(loadItems).toHaveBeenCalledWith(
      expect.objectContaining({ provider: ["tidal--1"] }),
    );
    expect(shownItems(listing).map((item) => item.uri)).toEqual([pinned.uri]);
  });

  it("goes back to a carried visit", async () => {
    signInWithSavedSettings({ providerFilter: ["tidal--1"] });
    const parent = artist({ item_id: "1" });
    const cached = album({ item_id: "a1" });
    await cacheArtistAlbums(parent, [cached], {
      ...sourceSelection,
      providerOverride: "spotify--1",
    });

    routerHistoryState.forward = "/albums/library/a1";
    const loadItems = vi.fn<LoadItemsFn>().mockResolvedValue([]);
    const listing = mountArtistAlbums(parent, loadItems, sourceSelection);
    await flushPromises();

    expect(loadItems).not.toHaveBeenCalled();
    expect(shownItems(listing).map((item) => item.uri)).toEqual([cached.uri]);
  });

  // a restored visit loads nothing, so the page hears from the listing which
  // source it is on
  it("tells the page which source a restored visit is on", async () => {
    const parent = artist({ item_id: "1" });
    await cacheArtistAlbums(parent, [album({ item_id: "a1" })], {
      ...sourceSelection,
      defaultProvider: "spotify--1",
    });

    const listing = mountArtistAlbums(
      parent,
      vi.fn<LoadItemsFn>().mockResolvedValue([]),
      sourceSelection,
    );
    await flushPromises();

    expect(listing.emitted("provider-change")?.at(-1)).toEqual([
      ["spotify--1"],
    ]);
  });

  it("restores the cached albums when they came from the carried source", async () => {
    const parent = artist({ item_id: "1" });
    const cached = album({ item_id: "a1" });
    await cacheArtistAlbums(parent, [cached], {
      ...sourceSelection,
      defaultProvider: "spotify--1",
    });

    const loadItems = vi.fn<LoadItemsFn>().mockResolvedValue([]);
    const listing = mountArtistAlbums(parent, loadItems, {
      ...sourceSelection,
      providerOverride: "spotify--1",
    });
    await flushPromises();

    expect(loadItems).not.toHaveBeenCalled();
    expect(shownItems(listing).map((item) => item.uri)).toEqual([cached.uri]);
  });
});

describe("ItemsListing date added sort", () => {
  // added together (one edit), then a later addition, a very old one, and
  // undated items (none, or unparsable), which sort as the oldest of all
  const batch = "2024-03-01T12:00:00+00:00";
  const playlistTracks = [
    track({ item_id: "1", name: "Batch 1", position: 1, date_added: batch }),
    track({ item_id: "2", name: "Undated", position: 2 }),
    track({ item_id: "3", name: "Batch 2", position: 3, date_added: batch }),
    track({
      item_id: "4",
      name: "Newer",
      position: 4,
      date_added: "2024-05-10T08:30:00+00:00",
    }),
    track({
      item_id: "5",
      name: "Old",
      position: 5,
      date_added: "1999-06-01T00:00:00+00:00",
    }),
    track({ item_id: "6", name: "Unparsable", position: 6, date_added: "?" }),
  ];

  async function sortedNames(sortKey: string) {
    const listing = mountListingRaw({
      itemtype: "playlisttracks",
      path: "playlist.1.library",
      // a flat listing: every item at once, sorted in the browser
      loadPagedData: undefined,
      loadItems: vi.fn().mockResolvedValue(playlistTracks),
      sortKeys: [sortKey, "position"],
    });
    await flushPromises();
    return (listing.vm as unknown as { pagedItems: Track[] }).pagedItems.map(
      (item) => item.name,
    );
  }

  it("lists the most recently added first, keeping additions made together in order", async () => {
    expect(await sortedNames("timestamp_added_desc")).toEqual([
      "Newer",
      "Batch 1",
      "Batch 2",
      "Old",
      "Undated",
      "Unparsable",
    ]);
  });

  it("lists the earliest added first", async () => {
    expect(await sortedNames("timestamp_added")).toEqual([
      "Undated",
      "Unparsable",
      "Old",
      "Batch 1",
      "Batch 2",
      "Newer",
    ]);
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

describe("ItemsListing server sort options", () => {
  const sortOptions: SortOptionInfo[] = [
    {
      field: SortField.TIMESTAMP_ADDED,
      supports_direction: true,
      default_direction: SortDirection.DESC,
      label_key: "timestamp_added",
    },
    {
      field: SortField.NAME,
      supports_direction: true,
      default_direction: SortDirection.ASC,
      label_key: "name",
    },
    {
      field: SortField.PLAY_COUNT,
      supports_direction: true,
      default_direction: SortDirection.DESC,
      label_key: "play_count",
    },
    {
      field: SortField.DURATION,
      supports_direction: true,
      default_direction: SortDirection.ASC,
      label_key: "duration",
    },
    {
      field: SortField.RANDOM,
      supports_direction: false,
      default_direction: null,
      label_key: "random",
    },
  ];

  beforeEach(() => {
    mockGetLibraryGenres.mockReset().mockResolvedValue([]);
    mockGetLibrarySortOptions.mockReset().mockResolvedValue(sortOptions);
    mockSubscribeMulti.mockReset().mockImplementation(events.subscribeMulti);
    mockSubscribe.mockReset().mockImplementation(events.subscribe);
    mockSetItemsListingPreference.mockReset();
    store.currentUser = undefined;
    store.prevState = undefined;
    store.mobileLayout = false;
  });

  it("loads server options, migrates saved sorts, and toggles a quick sort direction", async () => {
    store.currentUser = user({
      preferences: {
        "itemsListing.librarytracks.tracks": { sortBy: "name_desc" },
      },
    });
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = mountListingRaw({
      itemtype: "tracks",
      path: "librarytracks",
      sortMediaType: MediaType.TRACK,
      loadPagedData,
      showGenreFilter: false,
    });
    await flushPromises();

    expect(mockGetLibrarySortOptions).toHaveBeenCalledWith(MediaType.TRACK);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "name:desc" }),
    );

    const sortMenu = listing.findComponent(LibrarySortControls);
    await sortMenu.find("button").trigger("click");
    await flushPromises();
    expect(
      document.body.querySelectorAll('[role="menuitemradio"]'),
    ).toHaveLength(sortOptions.length + 2);
    expect(
      document.body.querySelectorAll(
        '[role="menuitemradio"][aria-checked="true"]',
      ),
    ).toHaveLength(2);
    expect(
      document.body.querySelectorAll(
        '[role="menuitemradio"][aria-checked="true"] svg.lucide-check',
      ),
    ).toHaveLength(2);

    const playCountChip = listing
      .findAll("button")
      .find((button) => button.text().includes("sort.play_count"));
    expect(playCountChip).toBeDefined();
    await playCountChip?.trigger("click");
    await flushPromises();
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "play_count:desc" }),
    );

    await playCountChip?.trigger("click");
    await flushPromises();
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "play_count:asc" }),
    );
  });

  it("keeps the desktop sort chip row stable while options load", async () => {
    let resolveSortOptions!: (options: SortOptionInfo[]) => void;
    mockGetLibrarySortOptions.mockReturnValue(
      new Promise<SortOptionInfo[]>((resolve) => {
        resolveSortOptions = resolve;
      }),
    );

    const listing = mountListingRaw({
      sortMediaType: MediaType.TRACK,
      showGenreFilter: false,
    });
    const chipsRow = listing.find(".listing-sort-chips-row");

    expect(chipsRow.exists()).toBe(true);
    expect(chipsRow.classes()).toContain("h-12");
    expect(chipsRow.findComponent(LibrarySortControls).exists()).toBe(false);

    resolveSortOptions(sortOptions);
    await flushPromises();

    expect(chipsRow.exists()).toBe(true);
    expect(chipsRow.findComponent(LibrarySortControls).props("mode")).toBe(
      "chips",
    );
  });

  it("preserves ascending semantics for unsuffixed legacy sort preferences", async () => {
    store.currentUser = user({
      preferences: {
        "itemsListing.librarytracks.tracks": { sortBy: "timestamp_added" },
      },
    });
    const loadPagedData = vi.fn().mockResolvedValue([]);

    mountListingRaw({
      itemtype: "tracks",
      path: "librarytracks",
      sortMediaType: MediaType.TRACK,
      loadPagedData,
      showGenreFilter: false,
    });
    await flushPromises();

    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "timestamp_added:asc" }),
    );
    expect(mockSetItemsListingPreference).toHaveBeenCalledWith(
      "librarytracks",
      "tracks",
      "sortBy",
      "timestamp_added:asc",
    );
  });

  it("excludes sort fields not shared by audiobook author tabs", async () => {
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = mountListingRaw({
      itemtype: "audiobooks",
      path: "libraryaudiobooks",
      sortMediaType: MediaType.AUDIOBOOK,
      sortOptionExcludeFields: [SortField.DURATION],
      loadPagedData,
      showGenreFilter: false,
    });
    await flushPromises();

    const controls = listing.findComponent(LibrarySortControls);
    const options = controls.props("options") as SortOptionInfo[];
    expect(options.map((option) => option.field)).not.toContain(
      SortField.DURATION,
    );
  });
});
