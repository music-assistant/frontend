import ItemsListing from "@/components/ItemsListing.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { Track } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { genre } from "../fixtures/genre";
import { track } from "../fixtures/track";

// Tracks live subscriptions the way the api does, so one that outlives the
// listing stays listed here.
const events = vi.hoisted(() => {
  const listeners: unknown[] = [];
  return {
    listeners,
    subscribeMulti: (_types: unknown, handler: unknown) => {
      listeners.push(handler);
      return () => {
        const index = listeners.indexOf(handler);
        if (index !== -1) listeners.splice(index, 1);
      };
    },
  };
});

const mockGetLibraryGenres = vi.hoisted(() =>
  vi.fn<MusicAssistantApi["getLibraryGenres"]>(),
);
const mockSubscribeMulti = vi.hoisted(() => vi.fn());

vi.mock("@/plugins/api", () => {
  const api = {
    providers: {},
    providerManifests: {},
    getLibraryGenres: mockGetLibraryGenres,
    subscribe_multi: mockSubscribeMulti,
  };
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await import("vue");
  return {
    store: reactive({
      dialogActive: false,
      showPlayersMenu: false,
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

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const stubComponent = vi.hoisted(() => (name: string) => ({
  default: { name, template: "<div />" },
}));

vi.mock("@/components/Toolbar.vue", () => stubComponent("Toolbar"));
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
        Button: true,
        Empty: true,
        EmptyContent: true,
        EmptyDescription: true,
        EmptyHeader: true,
        EmptyTitle: true,
        Tabs: true,
        TabsList: true,
        TabsTrigger: true,
        "v-divider": true,
        "v-text-field": true,
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
    store.prevState = undefined;
  });

  it("undoes everything it set up when the listing is closed", async () => {
    const listing = mountListingRaw();
    await flushPromises();

    expect(clearSelectionHandlers()).toBe(1);
    expect(events.listeners).toHaveLength(1);

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
