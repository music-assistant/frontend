import ItemsListing from "@/components/ItemsListing.vue";
import ListingSelectionBar from "@/components/ListingSelectionBar.vue";
import LibrarySortControls from "@/components/LibrarySortControls.vue";
import ListingSortMenu from "@/components/listing-toolbar/ListingSortMenu.vue";
import ListingToolbarControls from "@/components/listing-toolbar/ListingToolbarControls.vue";
import type {
  ListingFilter,
  ListingMultiFilter,
  ListingToggleFilter,
} from "@/helpers/listing_filters";
import { useEscapeBack } from "@/composables/useEscapeBack";
import { defineComponent, h, type SetupContext } from "vue";
import { api, type MusicAssistantApi } from "@/plugins/api";
import {
  EventType,
  ListingType,
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
const mockGetSortOptions = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockSubscribeMulti = vi.hoisted(() => vi.fn());
const mockSubscribe = vi.hoisted(() => vi.fn());

vi.mock("@/plugins/api", () => {
  const api = {
    providers: {},
    providerManifests: {},
    getLibraryGenres: mockGetLibraryGenres,
    getSortOptions: mockGetSortOptions,
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
const mockSetItemsListingPreferences = vi.hoisted(() => vi.fn());

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
      setItemsListingPreferences: mockSetItemsListingPreferences,
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

vi.mock("vue-sonner", () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));

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
vi.mock("@/components/icons/GenreIcon.vue", () => stubComponent("GenreIcon"));
vi.mock("@/components/skeletons/ListViewSkeleton.vue", () =>
  stubComponent("ListViewSkeleton"),
);
vi.mock("@/components/skeletons/PanelViewSkeleton.vue", () =>
  stubComponent("PanelViewSkeleton"),
);
vi.mock("@/components/ListviewItem.vue", () => stubComponent("ListviewItem"));
vi.mock("@/components/PanelviewItem.vue", () => stubComponent("PanelviewItem"));
vi.mock("@/components/track-table/TrackTableHeader.vue", () =>
  stubComponent("TrackTableHeader"),
);
vi.mock("@/components/track-table/TrackTableRow.vue", () =>
  stubComponent("TrackTableRow"),
);
vi.mock("@/composables/useTrackTableColumns", async () => {
  const { ref } = await import("vue");
  return {
    useTrackTableColumns: () => ({
      enabledColumns: ref([]),
      visibleColumns: ref([]),
      setEnabledColumns: vi.fn(),
    }),
  };
});

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
  stubs: Record<string, unknown> = {},
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
        VBtn: true,
        ...stubs,
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

    const listing = mountListingRaw({
      allowKeyHooks: true,
      loadPagedData,
      total: 3,
    });
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
          // sets the ones its re-renders get: keep its divider stubbed
          { global: { stubs: { "v-divider": true } } },
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

  it("offers search on a server-paged listing unless it is known to be small", async () => {
    const fullPage = Array.from({ length: 50 }, (_, i) =>
      track({ item_id: `track-${i}` }),
    );
    let resolveFirstPage!: (items: Track[]) => void;
    const large = mountListingRaw({
      loadPagedData: vi.fn().mockResolvedValue(fullPage),
    });
    const small = mountListingRaw({
      loadPagedData: vi
        .fn()
        .mockReturnValueOnce(
          new Promise<Track[]>((resolve) => (resolveFirstPage = resolve)),
        )
        .mockReturnValue(new Promise(() => {})),
    });
    await flushPromises();
    // nothing is known while the first page loads, which keeps search hidden
    expect(searchButton(small)).toBeUndefined();

    resolveFirstPage(fullPage.slice(0, 3));
    await flushPromises();
    expect(searchButton(large)).toBeDefined();
    expect(searchButton(small)).toBeUndefined();

    // a reload keeps it hidden on the rows it already shows
    small.vm.reload();
    await flushPromises();
    expect(searchButton(small)).toBeUndefined();
  });

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

  it("shows the selection bar for a multi-selection and clears it from there", async () => {
    const listing = mountListingRaw({
      allowKeyHooks: true,
      loadPagedData: vi
        .fn()
        .mockResolvedValue([track({ item_id: "1" }), track({ item_id: "2" })]),
    });
    await flushPromises();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "a", ctrlKey: true }),
    );
    await flushPromises();
    const bar = listing.getComponent(ListingSelectionBar);

    expect(bar.props()).toEqual({ open: true, count: 2, allSelected: true });

    bar.vm.$emit("clear");
    await flushPromises();

    expect(selection(listing)).toHaveLength(0);
    expect(bar.props("open")).toBe(false);
  });
});

describe("ItemsListing shift-click range", () => {
  const items = ["A", "B", "C", "D", "E"].map((name) =>
    track({ item_id: name, name, uri: `library://track/${name}` }),
  );

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
  });

  afterEach(() => {
    holdShift(false);
  });

  /** A tracks grid of A to E, so each item is a row that can be clicked. */
  async function mountGrid() {
    const listing = mountListingRaw({
      forcedViewMode: "panel",
      loadPagedData: vi.fn().mockResolvedValue(items),
    });
    await flushPromises();
    return listing;
  }

  function holdShift(held: boolean) {
    document.dispatchEvent(
      new KeyboardEvent(held ? "keydown" : "keyup", {
        key: "Shift",
        shiftKey: held,
      }),
    );
  }

  /** Ticks or unticks the item's checkbox, with Shift held or not. */
  async function click(
    listing: ReturnType<typeof mountListingRaw>,
    name: string,
    { selected = true, shift = false } = {},
  ) {
    holdShift(shift);
    const index = items.findIndex((item) => item.name === name);
    const row = listing.findAllComponents({ name: "PanelviewItem" })[index];
    row.vm.$emit("select", rows(listing)[index], selected);
    await flushPromises();
  }

  function selectedNames(listing: ReturnType<typeof mountListingRaw>) {
    return selection(listing).map((item) => item.name);
  }

  it("selects everything between the last click and a shift-click", async () => {
    const listing = await mountGrid();

    await click(listing, "B");
    await click(listing, "D", { shift: true });

    expect(selectedNames(listing)).toEqual(["B", "C", "D"]);
  });

  it("keeps a range picked upwards in listing order", async () => {
    const listing = await mountGrid();

    await click(listing, "E");
    await click(listing, "D");
    await click(listing, "A", { shift: true });

    // E was picked outside the range and keeps its place ahead of it
    expect(selectedNames(listing)).toEqual(["E", "A", "B", "C", "D"]);
  });

  it("clears a range with a shift-click that unticks", async () => {
    const listing = await mountGrid();
    await click(listing, "A");
    await click(listing, "E", { shift: true });

    await click(listing, "B", { selected: false });
    await click(listing, "D", { selected: false, shift: true });

    expect(selectedNames(listing)).toEqual(["A", "E"]);
  });

  it("changes only the clicked item without Shift", async () => {
    const listing = await mountGrid();

    await click(listing, "B");
    await click(listing, "D");

    expect(selectedNames(listing)).toEqual(["B", "D"]);
  });

  it("starts no range after the selection was cleared", async () => {
    const listing = await mountGrid();
    await click(listing, "A");

    eventbus.emit("clearSelection");
    await click(listing, "C", { shift: true });

    expect(selectedNames(listing)).toEqual(["C"]);
  });

  it("starts no range after moving to another folder", async () => {
    const listing = await mountGrid();
    await click(listing, "A");

    await listing.setProps({ path: "otherfolder" });
    await flushPromises();
    await click(listing, "C", { shift: true });

    expect(selectedNames(listing)).toEqual(["C"]);
  });
});

describe("ItemsListing failed load", () => {
  type LoadStatus = "ok" | "empty" | "loading" | "error";
  type LoadPagedData = NonNullable<
    InstanceType<typeof ItemsListing>["$props"]["loadPagedData"]
  >;
  type OnLoad = (options: {
    side: string;
    done: (status: LoadStatus) => void;
  }) => Promise<void>;

  // the infinite scroller as a box that hands out its load callback and shows its
  // error slot, so a test can stand in for it loading the next page
  const InfiniteScrollStub = {
    name: "VInfiniteScroll",
    props: { onLoad: { type: Function, default: undefined } },
    setup(props: { onLoad?: OnLoad }, { slots }: SetupContext) {
      return () =>
        h("div", [
          slots.default?.(),
          slots.error?.({
            side: "end",
            props: {
              onClick: () => props.onLoad?.({ side: "end", done: () => {} }),
            },
          }),
        ]);
    },
  };

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
  });

  function mountFailingListing(loadPagedData: LoadPagedData) {
    return mountListingRaw(
      {
        itemtype: "playlisttracks",
        path: "playlist.1.apple_music",
        showGenreFilter: false,
        loadPagedData,
      },
      {
        VInfiniteScroll: InfiniteScrollStub,
        // the first load's retry lives in the empty state
        Empty: false,
        EmptyContent: false,
        EmptyHeader: false,
        EmptyTitle: false,
      },
    );
  }

  async function scrollerLoads(listing: ReturnType<typeof mountListingRaw>) {
    const done = vi.fn();
    const onLoad = listing
      .findComponent({ name: "VInfiniteScroll" })
      .props("onLoad") as OnLoad;
    await onLoad({ side: "end", done });
    await flushPromises();
    return done;
  }

  function retryButton(listing: ReturnType<typeof mountListingRaw>) {
    return listing
      .findAll("button")
      .find((button) => button.text() === "settings.retry");
  }

  it("does not load again on its own after a load failed", async () => {
    const loadPagedData = vi
      .fn<LoadPagedData>()
      .mockRejectedValue(new Error("rate limited"));
    const listing = mountFailingListing(loadPagedData);
    await flushPromises();

    // a scroller loads as soon as it shows up, so none is shown until the user retries
    expect(listing.findComponent({ name: "VInfiniteScroll" }).exists()).toBe(
      false,
    );
    expect(retryButton(listing)).toBeDefined();
    expect(loadPagedData).toHaveBeenCalledTimes(1);
  });

  it("centres the failure like the empty state on full-page listings", async () => {
    const loadPagedData = vi
      .fn<LoadPagedData>()
      .mockRejectedValue(new Error("rate limited"));
    const listing = mountListingRaw(
      {
        itemtype: "playlisttracks",
        path: "playlist.1.apple_music",
        showGenreFilter: false,
        loadPagedData,
        fillHeight: true,
      },
      { VInfiniteScroll: InfiniteScrollStub },
    );
    await flushPromises();

    expect(listing.classes()).toContain("min-h-full");
  });

  it("loads from the start again when the user retries", async () => {
    const loadPagedData = vi
      .fn<LoadPagedData>()
      .mockRejectedValueOnce(new Error("rate limited"))
      .mockResolvedValue([track()]);
    const listing = mountFailingListing(loadPagedData);
    await flushPromises();

    await retryButton(listing)!.trigger("click");
    await flushPromises();

    expect(loadPagedData).toHaveBeenCalledTimes(2);
    expect(loadPagedData.mock.calls[1][0]).toMatchObject({ offset: 0 });
    // loaded, so the scroller finds the end instead of the failure
    expect(await scrollerLoads(listing)).toHaveBeenCalledWith("empty");
  });

  it("remounts an errored scroller after retrying a failed first-page reload", async () => {
    const loadPagedData = vi
      .fn<LoadPagedData>()
      .mockResolvedValueOnce([
        track({ item_id: "old-1" }),
        track({ item_id: "old-2" }),
      ])
      .mockRejectedValueOnce(new Error("filter failed"))
      .mockResolvedValueOnce([
        track({ item_id: "new-1" }),
        track({ item_id: "new-2" }),
      ])
      .mockResolvedValueOnce([track({ item_id: "new-3" })]);
    const listing = mountListingRaw(
      { showGenreFilter: false, loadPagedData, limit: 2 },
      { VInfiniteScroll: InfiniteScrollStub },
    );
    await flushPromises();
    const menuItems = listing
      .findComponent({ name: "Toolbar" })
      .props("menuItems") as {
      label?: string;
      action?: () => void;
    }[];
    menuItems.find((item) => item.label === "tooltip.filter_favorites")!
      .action!();
    await flushPromises();
    expect(await scrollerLoads(listing)).toHaveBeenCalledWith("error");
    const failedScroller = listing.findComponent({
      name: "VInfiniteScroll",
    }).vm;

    await retryButton(listing)!.trigger("click");
    await flushPromises();

    expect(listing.findComponent({ name: "VInfiniteScroll" }).vm).not.toBe(
      failedScroller,
    );
    expect(loadPagedData.mock.calls[2][0].offset).toBe(0);
    expect(await scrollerLoads(listing)).toHaveBeenCalledWith("ok");
    expect(loadPagedData.mock.calls[3][0].offset).toBe(2);
    expect(rows(listing).map((item) => item.item_id)).toEqual([
      "new-1",
      "new-2",
      "new-3",
    ]);
  });

  it("retries the page that failed, not the one after it", async () => {
    const offsets: number[] = [];
    let fail = false;
    const loadPagedData = vi.fn(async (params: { offset: number }) => {
      offsets.push(params.offset);
      if (fail) {
        fail = false;
        throw new Error("rate limited");
      }
      return [track(), track()];
    });
    const listing = mountListingRaw(
      { showGenreFilter: false, loadPagedData, limit: 2 },
      { VInfiniteScroll: InfiniteScrollStub },
    );
    await flushPromises();

    fail = true;
    expect(await scrollerLoads(listing)).toHaveBeenCalledWith("error");
    await retryButton(listing)!.trigger("click");
    await flushPromises();

    expect(offsets).toEqual([0, 2, 2]);
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
    const listing = mountListingRaw(
      {
        itemtype: "albums",
        path: "libraryalbums",
        showGenreFilter: false,
        loadPagedData: vi.fn().mockResolvedValue([album()]),
      },
      {
        PanelviewItem: {
          name: "PanelviewItem",
          props: ["showActions"],
          template: '<div class="ed-card__art" />',
        },
      },
    );
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

  interface SliderItem {
    label?: string;
    hide?: boolean;
    componentProps?: {
      size: number;
      showActions: boolean;
      actionsFit: boolean;
      supportsActions: boolean;
      onChange: (size: number) => void;
      onCommit: (size: number) => void;
      onToggleActions: (show: boolean) => void;
    };
  }

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

  it("shows the thumbs view without actions for a saved compact thumbs view", async () => {
    signInWithSavedGrid({ viewMode: "panel_compact" });
    const listing = await mountGrid();

    expect(columns(listing)).toBe("col-2");
    expect(slider(listing)?.componentProps?.showActions).toBe(false);
  });

  it("keeps captured menu props live across size and fit changes", async () => {
    signInWithSavedGrid({ viewMode: "panel" });
    const listing = await mountGrid();
    const captured = slider(listing)!.componentProps!;
    const cover = listing.get(".ed-card__art").element;
    const measure = vi.spyOn(cover, "getBoundingClientRect");
    try {
      for (const [size, width, fits] of [
        [-1, 149.75, false],
        [0, 150, true],
        [-1, 149, false],
      ] as const) {
        measure.mockReturnValue(new DOMRect(0, 0, width, width));
        captured.onChange(size);
        await flushPromises();
        expect(captured.size).toBe(size);
        expect(captured.actionsFit).toBe(fits);
        expect(slider(listing)?.componentProps).toBe(captured);
      }
    } finally {
      measure.mockRestore();
    }
  });

  it("updates the cards and captured menu props and saves the action toggle", async () => {
    signInWithSavedGrid({ viewMode: "panel" });
    const listing = await mountGrid();
    const captured = slider(listing)!.componentProps!;

    captured.onToggleActions(false);
    await flushPromises();

    expect(captured.showActions).toBe(false);
    expect(
      listing.findComponent({ name: "PanelviewItem" }).props("showActions"),
    ).toBe(false);
    expect(mockSetItemsListingPreference).toHaveBeenCalledWith(
      "libraryalbums",
      "albums",
      "showActions",
      false,
    );
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
      loadPagedData: loadItems,
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
        loadPagedData: loadItems,
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
          "v-infinite-scroll": true,
          "v-virtual-scroll": true,
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
  type LoadPagedData = NonNullable<Props["loadPagedData"]>;
  type LoadItemsFn = LoadPagedData;

  // an artist's albums are listed from the library or from one provider
  const sourceSelection: Partial<Props> = {
    providerFilterOptions: ["spotify--1", "tidal--1"],
    requireProviderSelection: true,
    libraryFilterOption: true,
  };

  /** Mounts an artist-albums listing whose items come from the server page. */
  function mountArtistAlbums(
    parentItem: Props["parentItem"],
    loadPagedData: LoadPagedData,
    props: Partial<Props> = {},
  ) {
    return mountListingRaw({
      itemtype: "artistalbums",
      path: "artistalbums",
      restoreState: true,
      parentItem,
      loadPagedData,
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
      vi.fn<LoadPagedData>().mockResolvedValue(cached),
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

describe("ItemsListing server ordering", () => {
  it("preserves the order returned by the paged loader", async () => {
    const listing = mountListingRaw({
      itemtype: "playlisttracks",
      path: "playlist.1.library",
      loadPagedData: vi
        .fn()
        .mockResolvedValue([
          track({ item_id: "2", name: "Book 2" }),
          track({ item_id: "1", name: "Book 1" }),
        ]),
    });
    await flushPromises();

    expect(rows(listing).map((item) => item.name)).toEqual([
      "Book 2",
      "Book 1",
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
      field: SortField.SORT_NAME,
      supports_direction: true,
      default_direction: SortDirection.ASC,
      label_key: "sort_name",
    },
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
    {
      field: SortField.RANDOM_PLAY_COUNT,
      supports_direction: false,
      default_direction: null,
      label_key: "random_play_count",
    },
  ];

  beforeEach(() => {
    mockGetLibraryGenres.mockReset().mockResolvedValue([]);
    mockGetSortOptions.mockReset().mockResolvedValue(sortOptions);
    mockToastError.mockReset();
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
      sortListing: ListingType.LIBRARY_TRACKS,
      loadPagedData,
      showGenreFilter: false,
    });
    await flushPromises();

    expect(mockGetSortOptions).toHaveBeenCalledWith(ListingType.LIBRARY_TRACKS);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "name:desc" }),
    );
    const sortControls = listing.findComponent(LibrarySortControls);
    const visibleFields = (
      sortControls.props("options") as SortOptionInfo[]
    ).map((option) => option.field);
    expect(visibleFields).not.toContain(SortField.RANDOM);
    expect(visibleFields).not.toContain(SortField.RANDOM_PLAY_COUNT);

    const sortMenu = listing.findComponent(LibrarySortControls);
    await sortMenu.find("button").trigger("click");
    await flushPromises();
    expect(
      document.body.querySelectorAll('[role="menuitemradio"]'),
    ).toHaveLength(
      sortOptions.filter(
        (option) =>
          option.field !== SortField.RANDOM &&
          option.field !== SortField.RANDOM_PLAY_COUNT,
      ).length + 2,
    );
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

  it("does not cache a visit while a sort change is queued during a reload", async () => {
    let resolveReload!: (items: Track[]) => void;
    const reloadedTrack = track({ item_id: "fresh-order" });
    const loadPagedData = vi
      .fn()
      .mockResolvedValueOnce([track({ item_id: "old-order" })])
      .mockImplementationOnce(
        () =>
          new Promise<Track[]>((resolve) => {
            resolveReload = resolve;
          }),
      )
      .mockResolvedValueOnce([reloadedTrack]);
    const props = {
      sortListing: ListingType.LIBRARY_TRACKS,
      loadPagedData,
      showGenreFilter: false,
      restoreState: true,
    };
    const listing = mountListingRaw(props);
    await flushPromises();
    const pendingReload = listing.vm.reload();
    const playCountChip = listing
      .findAll("button")
      .find((button) => button.text().includes("sort.play_count"));
    await playCountChip!.trigger("click");
    await flushPromises();
    listing.unmount();

    expect(store.prevState).toBeUndefined();
    store.currentUser = user({
      preferences: {
        "itemsListing.librarytracks.tracks": { sortBy: "play_count:desc" },
      },
    });
    const restored = mountListingRaw(props);
    await flushPromises();
    expect(loadPagedData).toHaveBeenCalledTimes(3);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offset: 0,
        sortField: SortField.PLAY_COUNT,
      }),
    );
    expect(rows(restored)).toEqual([reloadedTrack]);

    resolveReload([track({ item_id: "late-old-order" })]);
    await pendingReload;
    expect(store.prevState).toBeUndefined();
  });

  it("does not cache old rows after a favorites reload fails", async () => {
    const favoriteTrack = track({ item_id: "liked-track", favorite: true });
    const loadPagedData = vi
      .fn()
      .mockResolvedValueOnce([track({ favorite: false })])
      .mockRejectedValueOnce(new Error("favorites failed"))
      .mockResolvedValueOnce([favoriteTrack]);
    const props = {
      sortListing: ListingType.LIBRARY_TRACKS,
      loadPagedData,
      showGenreFilter: false,
      restoreState: true,
    };
    const listing = mountListingRaw(props);
    await flushPromises();
    const menuItems = listing
      .findComponent({ name: "Toolbar" })
      .props("menuItems") as {
      label?: string;
      action?: () => void;
    }[];
    menuItems.find((item) => item.label === "tooltip.filter_favorites")!
      .action!();
    await flushPromises();
    listing.unmount();

    expect(store.prevState).toBeUndefined();
    store.currentUser = user({
      preferences: {
        "itemsListing.librarytracks.tracks": { favoriteFilter: true },
      },
    });
    const restored = mountListingRaw(props);
    await flushPromises();
    expect(loadPagedData).toHaveBeenCalledTimes(3);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offset: 0,
        favoritesOnly: true,
      }),
    );
    expect(rows(restored)).toEqual([favoriteTrack]);
  });

  it("reloads instead of restoring rows from a failed sort", async () => {
    const reloadedTrack = track({ item_id: "play-count-first" });
    const loadPagedData = vi
      .fn()
      .mockResolvedValueOnce([track({ item_id: "track-1" })])
      .mockRejectedValueOnce(new Error("sort failed"))
      .mockResolvedValueOnce([reloadedTrack]);
    store.currentUser = user({
      preferences: {
        "itemsListing.librarytracks.tracks": { viewMode: "panel" },
      },
    });
    const props = {
      itemtype: "tracks",
      path: "librarytracks",
      sortListing: ListingType.LIBRARY_TRACKS,
      loadPagedData,
      showGenreFilter: false,
      restoreState: true,
    };
    const listing = mountListingRaw(props);
    await flushPromises();
    const playCountChip = listing
      .findAll("button")
      .find((button) => button.text().includes("sort.play_count"));
    await playCountChip!.trigger("click");
    await flushPromises();

    const expectDisplayedSort = (
      wrapper: ReturnType<typeof mountListingRaw>,
      field = SortField.SORT_NAME,
      direction = SortDirection.ASC,
    ) => {
      const playback = wrapper.vm as unknown as {
        sortField: SortField;
        sortDirection: SortDirection;
      };
      expect(playback.sortField).toBe(field);
      expect(playback.sortDirection).toBe(direction);
      const row = wrapper.findComponent({ name: "PanelviewItem" });
      expect(row.attributes("sort-field")).toBe(field);
      expect(row.attributes("sort-direction")).toBe(direction);
    };
    expectDisplayedSort(listing);
    listing.unmount();

    store.currentUser = user({
      preferences: {
        "itemsListing.librarytracks.tracks": {
          viewMode: "panel",
          sortBy: "play_count:desc",
        },
      },
    });
    const restored = mountListingRaw(props);
    await flushPromises();
    expect(loadPagedData).toHaveBeenCalledTimes(3);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offset: 0,
        sortField: SortField.PLAY_COUNT,
        sortDirection: SortDirection.DESC,
      }),
    );
    expect(rows(restored)).toEqual([reloadedTrack]);
    expectDisplayedSort(restored, SortField.PLAY_COUNT, SortDirection.DESC);
  });

  it("reloads the selected chip sort after a pending first page finishes", async () => {
    let resolveFirstPage!: (items: Track[]) => void;
    const firstPage = new Promise<Track[]>((resolve) => {
      resolveFirstPage = resolve;
    });
    const loadPagedData = vi
      .fn()
      .mockReturnValueOnce(firstPage)
      .mockResolvedValue([]);
    const listing = mountListingRaw({
      sortListing: ListingType.LIBRARY_TRACKS,
      loadPagedData,
      showGenreFilter: false,
    });
    await flushPromises();

    const playCountChip = listing
      .findAll("button")
      .find((button) => button.text().includes("sort.play_count"));
    expect(playCountChip).toBeDefined();
    expect(playCountChip?.attributes("disabled")).toBeUndefined();
    await playCountChip!.trigger("click");
    await flushPromises();
    expect(loadPagedData).toHaveBeenCalledTimes(1);

    resolveFirstPage([]);
    await flushPromises();

    expect(loadPagedData).toHaveBeenCalledTimes(2);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        offset: 0,
        sortField: SortField.PLAY_COUNT,
        sortDirection: SortDirection.DESC,
      }),
    );
  });

  it("defaults to the first server sort option when no preference is saved", async () => {
    const loadPagedData = vi.fn().mockResolvedValue([]);

    const listing = mountListingRaw({
      itemtype: "tracks",
      path: "librarytracks",
      sortListing: ListingType.LIBRARY_TRACKS,
      loadPagedData,
      showGenreFilter: false,
    });
    await flushPromises();

    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sortBy: "sort_name:asc",
        sortField: SortField.SORT_NAME,
        sortDirection: SortDirection.ASC,
      }),
    );
    expect(
      listing
        .find(".listing-sort-chips-row")
        .findAll('button[aria-pressed="true"]')
        .map((chip) => chip.text()),
    ).toEqual(["sort.sort_name"]);
  });

  it("keeps the desktop sort chip row stable while options load", async () => {
    let resolveSortOptions!: (options: SortOptionInfo[]) => void;
    mockGetSortOptions.mockReturnValue(
      new Promise<SortOptionInfo[]>((resolve) => {
        resolveSortOptions = resolve;
      }),
    );

    const listing = mountListingRaw({
      sortListing: ListingType.LIBRARY_TRACKS,
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

  it("leaves out the desktop sort chip row when no quick sort is offered", async () => {
    mockGetSortOptions.mockResolvedValue(
      sortOptions.filter((option) =>
        [SortField.NAME, SortField.DURATION].includes(option.field),
      ),
    );

    const listing = mountListingRaw({
      sortListing: ListingType.PODCAST_EPISODES,
      showGenreFilter: false,
    });
    expect(listing.find(".listing-sort-chips-row").exists()).toBe(true);
    await flushPromises();

    expect(listing.find(".listing-sort-chips-row").exists()).toBe(false);
    expect(listing.findComponent(LibrarySortControls).props("mode")).toBe(
      "menu",
    );
  });

  it("uses one toast ID when shared genre sort options fail in multiple listings", async () => {
    mockGetSortOptions.mockRejectedValue(new Error("request failed"));

    const listings = ["music", "podcasts", "audiobooks"].map((contentType) =>
      mountListingRaw({
        itemtype: "genres",
        path: `librarygenres.${contentType}`,
        sortListing: ListingType.LIBRARY_GENRES,
        showGenreFilter: false,
      }),
    );
    await flushPromises();

    expect(mockToastError).toHaveBeenCalledTimes(3);
    for (const call of mockToastError.mock.calls) {
      expect(call).toEqual([
        "settings.error_loading_sort_options",
        { id: "library-sort-options-error" },
      ]);
    }
    listings.forEach((listing) => listing.unmount());
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
      sortListing: ListingType.LIBRARY_TRACKS,
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
      sortListing: ListingType.LIBRARY_AUDIOBOOKS,
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

  it.each([
    { tabbed: false, firstLoad: "listing:0" },
    { tabbed: true, firstLoad: "books:0" },
  ])(
    "loads the first page while the sort options are still loading (tabbed: $tabbed)",
    async ({ tabbed, firstLoad }) => {
      let resolveSortOptions!: (options: SortOptionInfo[]) => void;
      mockGetSortOptions.mockReturnValue(
        new Promise<SortOptionInfo[]>((resolve) => {
          resolveSortOptions = resolve;
        }),
      );
      const loads: string[] = [];
      const pages: ((items: Track[]) => void)[] = [];
      const loader = (source: string) => (params: { offset: number }) => {
        loads.push(`${source}:${params.offset}`);
        return new Promise<Track[]>((resolve) => pages.push(resolve));
      };
      // the real scroller loads a page as soon as it shows up
      const LoadingScroller = {
        name: "VInfiniteScroll",
        props: { onLoad: { type: Function, default: undefined } },
        mounted(this: { onLoad: (options: { done: () => void }) => void }) {
          this.onLoad({ done: () => {} });
        },
        template: "<div><slot /></div>",
      };
      const listing = mountListingRaw(
        {
          itemtype: "audiobooks",
          path: "libraryaudiobooks",
          sortListing: ListingType.LIBRARY_AUDIOBOOKS,
          loadPagedData: loader("listing"),
          toolBarTabs: tabbed
            ? [
                { id: "books", label: "books", loadPagedData: loader("books") },
                {
                  id: "authors",
                  label: "authors",
                  loadPagedData: loader("authors"),
                },
              ]
            : undefined,
        },
        { VInfiniteScroll: LoadingScroller },
      );
      await flushPromises();

      resolveSortOptions(sortOptions);
      await flushPromises();
      pages.forEach((resolve) => resolve([track()]));
      await flushPromises();

      expect(loads).toEqual([firstLoad]);
      expect(
        (listing.vm as unknown as { pagedItems: Track[] }).pagedItems,
      ).toHaveLength(1);
    },
  );

  it("shows multi-disc headers for paged album tracks in track order", async () => {
    mockGetSortOptions.mockResolvedValueOnce([
      {
        field: SortField.TRACK_NUMBER,
        supports_direction: true,
        default_direction: SortDirection.ASC,
        label_key: "track_number",
      },
    ]);
    store.currentUser = user({
      preferences: {
        "itemsListing.albumtracks.albumtracks": { sortBy: "track_number" },
      },
    });
    const listing = mountListingRaw(
      {
        itemtype: "albumtracks",
        path: "albumtracks",
        sortListing: ListingType.ALBUM_TRACKS,
        loadPagedData: vi
          .fn()
          .mockResolvedValue([
            track({ item_id: "disc-1", disc_number: 1, track_number: 1 }),
            track({ item_id: "disc-2", disc_number: 2, track_number: 1 }),
          ]),
      },
      {
        VVirtualScroll: {
          props: ["items"],
          template:
            '<div><slot v-for="(item, index) in items" :key="index" :item="item" :index="index" /></div>',
        },
      },
    );
    await flushPromises();

    expect(listing.findAll(".disc-header")).toHaveLength(2);
  });

  it("reloads with the normalized sort when options change during a request", async () => {
    store.currentUser = user({
      preferences: {
        "itemsListing.libraryaudiobooks.audiobooks": { sortBy: "duration:asc" },
      },
    });
    let resolveFirstPage!: (items: Track[]) => void;
    const firstPage = new Promise<Track[]>((resolve) => {
      resolveFirstPage = resolve;
    });
    const loadPagedData = vi
      .fn()
      .mockReturnValueOnce(firstPage)
      .mockResolvedValue([]);
    const listing = mountListingRaw({
      itemtype: "audiobooks",
      path: "libraryaudiobooks",
      sortListing: ListingType.LIBRARY_AUDIOBOOKS,
      loadPagedData,
      showGenreFilter: false,
    });

    await flushPromises();
    expect(loadPagedData).toHaveBeenCalledTimes(1);
    expect(
      listing
        .findComponent(LibrarySortControls)
        .find("button")
        .attributes("disabled"),
    ).toBeUndefined();
    expect(loadPagedData).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sortField: SortField.DURATION,
        sortDirection: SortDirection.ASC,
      }),
    );

    await listing.setProps({
      sortOptionExcludeFields: [SortField.DURATION],
    });
    await flushPromises();
    expect(loadPagedData).toHaveBeenCalledTimes(1);

    resolveFirstPage([]);
    await flushPromises();

    expect(loadPagedData).toHaveBeenCalledTimes(2);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sortField: SortField.SORT_NAME,
        sortDirection: SortDirection.ASC,
      }),
    );
  });
});

describe("ItemsListing library toolbar", () => {
  const sortOptions: SortOptionInfo[] = [
    {
      field: SortField.SORT_NAME,
      supports_direction: true,
      default_direction: SortDirection.ASC,
      label_key: "sort_name",
    },
    {
      field: SortField.TIMESTAMP_ADDED,
      supports_direction: true,
      default_direction: SortDirection.DESC,
      label_key: "timestamp_added",
    },
  ];

  beforeEach(() => {
    eventbus.all.clear();
    events.listeners.length = 0;
    mockGetLibraryGenres.mockReset().mockResolvedValue([]);
    mockGetSortOptions.mockReset().mockResolvedValue(sortOptions);
    mockSubscribeMulti.mockReset().mockImplementation(events.subscribeMulti);
    mockSetItemsListingPreference.mockClear();
    store.prevState = undefined;
    store.currentUser = undefined;
    store.mobileLayout = false;
  });

  afterEach(() => {
    store.currentUser = undefined;
    store.mobileLayout = false;
  });

  /** Signs in a user who saved these settings for the artists page. */
  function signInWithSavedFilters(settings: Record<string, unknown>) {
    store.currentUser = user({
      preferences: { "itemsListing.libraryartists.artists": settings },
    });
  }

  async function mountLibraryPage(
    props: Partial<InstanceType<typeof ItemsListing>["$props"]> = {},
    stubs: Record<string, unknown> = {},
  ) {
    const listing = mountListingRaw(
      {
        itemtype: "artists",
        path: "libraryartists",
        sortListing: ListingType.LIBRARY_ARTISTS,
        libraryToolbar: true,
        showGenreFilter: false,
        showFavoritesOnlyFilter: true,
        showAlbumArtistsOnlyFilter: true,
        showSearchButton: true,
        ...props,
      },
      // its tooltip needs the provider the app's sidebar gives
      { GridSizeSlider: true, ...stubs },
    );
    await flushPromises();
    return listing;
  }

  function menuLabels(listing: ReturnType<typeof mountListingRaw>) {
    return (
      listing.findComponent({ name: "Toolbar" }).props("menuItems") as {
        label?: string;
      }[]
    ).map((item) => item.label);
  }

  it("sorts from the title bar instead of a row of chips", async () => {
    const listing = await mountLibraryPage();

    expect(listing.find(".listing-sort-chips-row").exists()).toBe(false);
    expect(listing.findComponent(LibrarySortControls).exists()).toBe(false);
    expect(listing.findComponent(ListingSortMenu).props("compact")).toBe(false);
  });

  it("flips the sort it is on when picked again, with the menu left open", async () => {
    mockGetSortOptions.mockResolvedValueOnce([
      { field: SortField.SORT_NAME, supports_direction: true },
      { field: SortField.TIMESTAMP_ADDED, supports_direction: true },
    ] as SortOptionInfo[]);
    signInWithSavedFilters({ sortBy: "sort_name:asc" });
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = await mountLibraryPage({ loadPagedData });

    await listing
      .findComponent(ListingSortMenu)
      .find("button")
      .trigger("click");
    await flushPromises();
    const checked = () =>
      document.body.querySelector<HTMLElement>(
        '[role="menuitemradio"][aria-checked="true"]',
      );
    // the sort it is on is shown in blue with its arrow, without a check mark
    expect(checked()?.querySelector("svg.lucide-check")).toBeNull();
    expect(checked()?.querySelector("svg.lucide-arrow-up")).not.toBeNull();

    checked()?.click();
    await flushPromises();

    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "sort_name:desc" }),
    );
    expect(
      document.body.querySelectorAll('[role="menuitemradio"]').length,
    ).toBeGreaterThan(0);
    listing.unmount();
  });

  it("sorts from an icon on a phone", async () => {
    store.mobileLayout = true;
    const listing = await mountLibraryPage();

    expect(listing.findComponent(ListingSortMenu).props("compact")).toBe(true);
  });

  it("keeps search and the filters out of the overflow menu", async () => {
    const listing = await mountLibraryPage();

    expect(menuLabels(listing)).not.toContain("tooltip.search");
    expect(menuLabels(listing)).not.toContain("tooltip.filter_favorites");
    expect(menuLabels(listing)).not.toContain("tooltip.album_artist_filter");
    expect(menuLabels(listing)).not.toContain("tooltip.view_mode_current");
  });

  it("picks the view and cover size in the sort menu", async () => {
    signInWithSavedFilters({ viewMode: "panel", gridSize: -1 });
    const listing = await mountLibraryPage();
    const sortMenu = listing.findComponent(ListingSortMenu);

    expect(sortMenu.props("viewMode")).toBe("panel");
    expect(sortMenu.props("gridControls")?.size).toBe(-1);
    expect(menuLabels(listing)).not.toContain("grid_size");

    sortMenu.vm.$emit("view-mode", "list");
    await flushPromises();

    expect(mockSetItemsListingPreference).toHaveBeenCalledWith(
      "libraryartists",
      "artists",
      "viewMode",
      "list",
    );
  });

  it("picks the view in the sort menu on a phone too", async () => {
    store.mobileLayout = true;
    signInWithSavedFilters({ viewMode: "panel" });
    const listing = await mountLibraryPage();

    expect(listing.findComponent(ListingSortMenu).props("viewMode")).toBe(
      "panel",
    );
    expect(menuLabels(listing)).not.toContain("tooltip.view_mode_current");
    expect(menuLabels(listing)).not.toContain("grid_size");
  });

  it("opens the search field from its icon and closes it from inside", async () => {
    const listing = await mountLibraryPage();
    const searchIcon = () => listing.find('button[aria-label="search"]');

    await searchIcon().trigger("click");
    await flushPromises();

    expect(searchIcon().exists()).toBe(false);
    expect(listing.find("input").exists()).toBe(true);

    await listing.find('button[aria-label="close"]').trigger("click");
    await flushPromises();

    expect(searchIcon().exists()).toBe(true);
  });

  it("counts every active filter on the Filters button", async () => {
    signInWithSavedFilters({ favoriteFilter: true, albumArtistsFilter: true });
    const listing = await mountLibraryPage();

    expect(
      listing.findComponent(ListingToolbarControls).props("activeFilterCount"),
    ).toBe(2);
  });

  it("clears every filter at once, in a single save", async () => {
    signInWithSavedFilters({ favoriteFilter: true, albumArtistsFilter: true });
    const listing = await mountLibraryPage();
    mockSetItemsListingPreferences.mockClear();

    listing.findComponent(ListingToolbarControls).vm.$emit("clear-filters");
    await flushPromises();

    expect(mockSetItemsListingPreferences).toHaveBeenCalledOnce();
    expect(mockSetItemsListingPreferences).toHaveBeenCalledWith(
      "libraryartists",
      "artists",
      { favoriteFilter: false, albumArtistsFilter: false },
    );
    expect(
      listing.findComponent(ListingToolbarControls).props("activeFilterCount"),
    ).toBe(0);
  });

  it("keeps a cached visit's count while scrolling to its next page", async () => {
    signInWithSavedFilters({ favoriteFilter: true });
    const scroller = {
      name: "VInfiniteScroll",
      props: { onLoad: { type: Function, default: undefined } },
      template: "<div><slot /></div>",
    };
    // a full page, so there is a next one to scroll to
    const props = {
      total: 12,
      limit: 1,
      restoreState: true,
      loadPagedData: vi.fn().mockResolvedValue([artist()]),
    };
    const listing = await mountLibraryPage(props, {
      VInfiniteScroll: scroller,
    });
    listing.unmount();

    // the page starts over from the whole library's count
    const restored = await mountLibraryPage(
      { ...props, total: 128 },
      { VInfiniteScroll: scroller },
    );
    const onLoad = restored
      .findComponent({ name: "VInfiniteScroll" })
      .props("onLoad") as (options: {
      side: string;
      done: () => void;
    }) => Promise<void>;
    await onLoad({ side: "end", done: () => {} });
    await flushPromises();

    expect(props.loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 1 }),
    );
    expect(restored.find(".toolbar-stub").text()).toContain("12");
    expect(restored.find(".toolbar-stub").text()).not.toContain("128");
  });

  it("drops a cached visit's count when a filter changes while a page loads", async () => {
    signInWithSavedFilters({ favoriteFilter: true });
    const scroller = {
      name: "VInfiniteScroll",
      props: { onLoad: { type: Function, default: undefined } },
      template: "<div><slot /></div>",
    };
    const loadPagedData = vi.fn().mockResolvedValue([artist()]);
    const props = { total: 12, limit: 1, restoreState: true, loadPagedData };
    const listing = await mountLibraryPage(props, {
      VInfiniteScroll: scroller,
    });
    listing.unmount();
    const restored = await mountLibraryPage(
      { ...props, total: 128 },
      { VInfiniteScroll: scroller },
    );

    // the next page is still on its way when Favorites is turned off
    let finishPage!: (items: unknown[]) => void;
    loadPagedData.mockImplementationOnce(
      () => new Promise((resolve) => (finishPage = resolve)),
    );
    const onLoad = restored
      .findComponent({ name: "VInfiniteScroll" })
      .props("onLoad") as (options: {
      side: string;
      done: () => void;
    }) => Promise<void>;
    void onLoad({ side: "end", done: () => {} });
    await flushPromises();
    (
      (
        restored
          .findComponent(ListingToolbarControls)
          .props("filters") as ListingFilter[]
      ).find((filter) => filter.id === "favorites") as ListingToggleFilter
    ).toggle();
    await flushPromises();
    finishPage([artist()]);
    await flushPromises();

    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 0, favoritesOnly: false }),
    );
    expect(restored.find(".toolbar-stub").text()).toContain("128");
  });

  it("hides the search icon while the section is collapsed", async () => {
    signInWithSavedFilters({ expand: false });
    const listing = await mountLibraryPage({ allowCollapse: true });

    expect(listing.find('button[aria-label="search"]').exists()).toBe(false);
  });

  it("keeps an edit that is still being saved when an earlier save lands", async () => {
    let finishSave!: () => void;
    mockSetItemsListingPreference.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = await mountLibraryPage({ loadPagedData });
    const favorites = (
      listing
        .findComponent(ListingToolbarControls)
        .props("filters") as ListingFilter[]
    ).find((filter) => filter.id === "favorites") as ListingToggleFilter;

    favorites.toggle();
    await flushPromises();
    // an earlier sort save lands, from before Favorites was turned on
    store.currentUser = user({
      preferences: {
        "itemsListing.libraryartists.artists": { sortBy: "name_desc" },
      },
    });
    await flushPromises();
    // then the Favorites save itself, merged onto it
    store.currentUser = user({
      preferences: {
        "itemsListing.libraryartists.artists": {
          sortBy: "name_desc",
          favoriteFilter: true,
        },
      },
    });
    await flushPromises();
    finishSave();
    await flushPromises();

    expect(
      listing.findComponent(ListingToolbarControls).props("activeFilterCount"),
    ).toBe(1);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ favoritesOnly: true }),
    );
  });

  it("goes back to the saved settings after a save fails", async () => {
    let finishSave!: () => void;
    mockSetItemsListingPreference.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = await mountLibraryPage({ loadPagedData });
    const favorites = (
      listing
        .findComponent(ListingToolbarControls)
        .props("filters") as ListingFilter[]
    ).find((filter) => filter.id === "favorites") as ListingToggleFilter;

    favorites.toggle();
    await flushPromises();
    // the server would not take it, so the account's settings are put back
    store.currentUser = user({
      preferences: { "itemsListing.libraryartists.artists": {} },
    });
    await flushPromises();
    finishSave();
    await flushPromises();

    expect(
      listing.findComponent(ListingToolbarControls).props("activeFilterCount"),
    ).toBe(0);
    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ favoritesOnly: false }),
    );
  });

  it("leaves a listing that was left alone when its failed save settles", async () => {
    let finishSave!: () => void;
    mockSetItemsListingPreference.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = await mountLibraryPage({ loadPagedData });
    const favorites = (
      listing
        .findComponent(ListingToolbarControls)
        .props("filters") as ListingFilter[]
    ).find((filter) => filter.id === "favorites") as ListingToggleFilter;

    favorites.toggle();
    await flushPromises();
    store.currentUser = user({
      preferences: { "itemsListing.libraryartists.artists": {} },
    });
    await flushPromises();
    listing.unmount();
    loadPagedData.mockClear();
    finishSave();
    await flushPromises();

    expect(loadPagedData).not.toHaveBeenCalled();
  });

  it("turns album artists back off when its first save fails", async () => {
    let finishSave!: () => void;
    mockSetItemsListingPreference.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    const listing = await mountLibraryPage();
    const albumArtists = (
      listing
        .findComponent(ListingToolbarControls)
        .props("filters") as ListingFilter[]
    ).find((filter) => filter.id === "album_artists") as ListingToggleFilter;

    albumArtists.toggle();
    await flushPromises();
    // never saved before, so the account goes back to holding nothing for it
    store.currentUser = user({
      preferences: { "itemsListing.libraryartists.artists": {} },
    });
    await flushPromises();
    finishSave();
    await flushPromises();

    expect(
      listing.findComponent(ListingToolbarControls).props("activeFilterCount"),
    ).toBe(0);
  });

  it("keeps a picked source on offer once it is the only one left", async () => {
    for (const [instanceId, name] of [
      ["spotify--1", "Spotify"],
      ["tidal--1", "Tidal"],
    ]) {
      api.providers[instanceId] = {
        instance_id: instanceId,
        name,
        domain: name.toLowerCase(),
      } as ProviderInstance;
    }
    try {
      const listing = await mountLibraryPage({
        providerFilterOptions: ["spotify--1", "tidal--1"],
      });
      const controls = () => listing.findComponent(ListingToolbarControls);
      const source = () =>
        (controls().props("filters") as ListingFilter[]).find(
          (filter) => filter.id === "provider",
        ) as ListingMultiFilter | undefined;

      source()?.toggle("spotify--1");
      await flushPromises();
      // the other source goes away while Spotify is picked
      await listing.setProps({ providerFilterOptions: ["spotify--1"] });
      await flushPromises();

      expect(source()?.selected).toEqual(["spotify--1"]);
      expect(controls().props("activeFilterCount")).toBe(1);
    } finally {
      delete api.providers["spotify--1"];
      delete api.providers["tidal--1"];
    }
  });

  it("reloads once when a failed save brings back another search", async () => {
    signInWithSavedFilters({ search: "adele" });
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = await mountLibraryPage({
      loadPagedData,
      restoreState: true,
    });
    let finishSave!: () => void;
    mockSetItemsListingPreference.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    await listing.find("input").setValue("beatles");
    await flushPromises();
    // the server would not take it, so the saved search is put back
    store.currentUser = user({
      preferences: {
        "itemsListing.libraryartists.artists": { search: "adele" },
      },
    });
    await flushPromises();
    loadPagedData.mockClear();
    finishSave();
    await flushPromises();

    expect(loadPagedData).toHaveBeenCalledOnce();
    expect(loadPagedData).toHaveBeenCalledWith(
      expect.objectContaining({ search: "adele" }),
    );
  });

  it("clears a search that failed to save when none was saved before", async () => {
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = await mountLibraryPage({
      loadPagedData,
      restoreState: true,
    });
    let finishSave!: () => void;
    mockSetItemsListingPreference.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );
    await listing.find('button[aria-label="search"]').trigger("click");
    await listing.find("input").setValue("beatles");
    await flushPromises();
    // the server would not take it, so the account holds no search again
    store.currentUser = user({
      preferences: { "itemsListing.libraryartists.artists": {} },
    });
    await flushPromises();
    finishSave();
    await flushPromises();

    expect(loadPagedData).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "" }),
    );
  });

  it("reloads the saved tab's rows after a tab save fails", async () => {
    store.currentUser = user({
      preferences: {
        "itemsListing.libraryaudiobooks.audiobooks": { activeTab: "books" },
      },
    });
    const books = vi.fn().mockResolvedValue([]);
    const authors = vi.fn().mockResolvedValue([]);
    const listing = mountListingRaw({
      itemtype: "audiobooks",
      path: "libraryaudiobooks",
      libraryToolbar: true,
      showGenreFilter: false,
      toolBarTabs: [
        { id: "books", label: "books", loadPagedData: books },
        { id: "authors", label: "authors", loadPagedData: authors },
      ],
    });
    await flushPromises();
    let finishSave!: () => void;
    mockSetItemsListingPreference.mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishSave = resolve)),
    );

    listing
      .findComponent({ name: "Tabs" })
      .vm.$emit("update:modelValue", "authors");
    await flushPromises();
    expect(authors).toHaveBeenCalled();
    // the server would not take it, so the account is back on Books
    store.currentUser = user({
      preferences: {
        "itemsListing.libraryaudiobooks.audiobooks": { activeTab: "books" },
      },
    });
    await flushPromises();
    books.mockClear();
    finishSave();
    await flushPromises();

    expect(books).toHaveBeenCalledOnce();
  });

  it("turns a filter off when the saved settings later leave it off", async () => {
    signInWithSavedFilters({ favoriteFilter: true });
    const listing = await mountLibraryPage();
    const filterCount = () =>
      listing.findComponent(ListingToolbarControls).props("activeFilterCount");
    expect(filterCount()).toBe(1);

    // a save queued behind an earlier one lands, and clears what that restored
    store.currentUser!.preferences = {
      "itemsListing.libraryartists.artists": { favoriteFilter: false },
    };
    await flushPromises();

    expect(filterCount()).toBe(0);
  });

  it("comes back to a cached visit with the count it showed", async () => {
    signInWithSavedFilters({ favoriteFilter: true });
    // a full page, so the listing does not know it holds everything
    const props = {
      total: 12,
      limit: 1,
      restoreState: true,
      loadPagedData: vi.fn().mockResolvedValue([artist()]),
    };
    const listing = await mountLibraryPage(props);
    expect(listing.find(".toolbar-stub").text()).toContain("12");
    listing.unmount();

    // the page starts over from the whole library's count
    const restored = await mountLibraryPage({ ...props, total: 128 });

    expect(restored.find(".toolbar-stub").text()).toContain("12");
    expect(restored.find(".toolbar-stub").text()).not.toContain("128");
  });

  // the field's own open and close transition, which the hooks hang off
  const realTransitions = { transition: false };
  const nextFrames = async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await flushPromises();
    }
  };

  it("gives focus back to the search icon when the field closes", async () => {
    const listing = await mountLibraryPage({}, realTransitions);
    await listing.find('button[aria-label="search"]').trigger("click");
    await nextFrames();
    const close = listing.find('button[aria-label="close"]');
    (close.element as HTMLElement).focus();

    await close.trigger("click");
    await nextFrames();

    expect(document.activeElement).toBe(
      listing.find('button[aria-label="search"]').element,
    );
  });

  it("brings the search icon back after the search moved to a phone", async () => {
    const listing = await mountLibraryPage({}, realTransitions);
    await listing.find('button[aria-label="search"]').trigger("click");
    await nextFrames();

    store.mobileLayout = true;
    await nextFrames();
    await listing.find('button[aria-label="close"]').trigger("click");
    await nextFrames();

    expect(listing.find('button[aria-label="search"]').exists()).toBe(true);
  });

  it("takes a new album type selection with one save and one reload", async () => {
    signInWithSavedFilters({ albumType: ["album", "single"] });
    const loadPagedData = vi.fn().mockResolvedValue([]);
    const listing = await mountLibraryPage({
      showAlbumTypeFilter: true,
      loadPagedData,
    });
    mockSetItemsListingPreference.mockClear();
    loadPagedData.mockClear();

    const albumTypes = (
      listing
        .findComponent(ListingToolbarControls)
        .props("filters") as ListingFilter[]
    ).find((filter) => filter.id === "album_type") as ListingMultiFilter;
    albumTypes.set?.([]);
    await flushPromises();

    expect(mockSetItemsListingPreference).toHaveBeenCalledOnce();
    expect(mockSetItemsListingPreference).toHaveBeenCalledWith(
      "libraryartists",
      "artists",
      "albumType",
      [],
    );
    expect(loadPagedData).toHaveBeenCalledOnce();
  });

  it("counts the items only while the page's total covers the filters", async () => {
    // a full page, so the listing does not know it holds everything
    const listing = await mountLibraryPage({
      total: 128,
      limit: 1,
      loadPagedData: vi.fn().mockResolvedValue([artist()]),
    });

    expect(listing.find(".toolbar-stub").text()).toContain("128");

    // the page's count request is not told about a search
    await listing.find('button[aria-label="search"]').trigger("click");
    await listing.find("input").setValue("be");
    await flushPromises();

    expect(listing.find(".toolbar-stub").text()).not.toContain("128");
  });
});
