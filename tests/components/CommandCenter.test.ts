import CommandCenter from "@/components/CommandCenter.vue";
import { useCommandCenter } from "@/composables/useCommandCenter";
import type { SearchTarget } from "@/composables/useProgressiveSearch";
import { MediaType, type Player } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ref } from "vue";

const state = vi.hoisted(() => ({
  resultsByType: {} as Record<string, unknown[]>,
  // real search results arrive through reactive state; tests emulate that by
  // bumping this after mutating resultsByType outside a query change
  bumpResults: () => {},
  // the source selection the palette hands to the search composable
  providersRef: undefined as Ref<string[]> | undefined,
  providerTargets: { value: [] as SearchTarget[] },
  players: [] as unknown[],
  prefs: {} as Record<string, unknown>,
  searchSpy: vi.fn(),
  setPreferenceSpy: vi.fn(),
  routerPush: vi.fn(),
  route: { fullPath: "/" },
  playBtnSpy: vi.fn(),
  menuBtnSpy: vi.fn(),
  loading: { value: false },
  storeMock: {
    isTouchscreen: false,
    dialogActive: false,
    activePlayerId: undefined as string | undefined,
    mobileLayout: false,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: state.storeMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-router", async () => {
  const { reactive } = await import("vue");
  state.route = reactive(state.route);
  return {
    useRouter: () => ({ push: state.routerPush }),
    useRoute: () => state.route,
  };
});

vi.mock("@/plugins/api", () => {
  const apiMock = { players: {} };
  return { api: apiMock, default: apiMock };
});

vi.mock("@/helpers/media_item_actions", () => ({
  handlePlayBtnClick: state.playBtnSpy,
  handleMenuBtnClick: state.menuBtnSpy,
}));

vi.mock("@/composables/useProgressiveSearch", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/composables/useProgressiveSearch")>();
  const { computed, ref } = await import("vue");
  const resultsVersion = ref(0);
  state.bumpResults = () => {
    resultsVersion.value += 1;
  };
  const providerTargets = ref<SearchTarget[]>([]);
  state.providerTargets = providerTargets;
  // a reactive stand-in so a test can flip the loading state mid-search
  state.loading = ref(false);
  return {
    ...actual,
    useProgressiveSearch: (options: { providers?: Ref<string[]> }) => {
      state.providersRef = options.providers;
      // the real composable records the submitted term here; the palette shows
      // the fetched results only while the box still holds that same term
      const activeSearchTerm = ref("");
      return {
        loading: computed(() => state.loading.value),
        activeSearchTerm,
        search: (term?: string) => {
          activeSearchTerm.value = term?.trim() ?? "";
          return state.searchSpy(term);
        },
        providerTargets,
        // the real composable drops the ids of providers that are no target
        selectedProviders: computed(() =>
          (options.providers?.value ?? []).filter(
            (id) =>
              id === actual.LIBRARY_SEARCH_TARGET ||
              providerTargets.value.some((target) => target.id === id),
          ),
        ),
        filteredItems: (mediaType: string) => {
          void resultsVersion.value;
          return state.resultsByType[mediaType] ?? [];
        },
      };
    },
  };
});

vi.mock("@/composables/useOrderedPlayers", async () => {
  const { computed } = await import("vue");
  return {
    useOrderedPlayers: () => computed(() => state.players),
  };
});

vi.mock("@/composables/userPreferences", async () => {
  const { computed, ref } = await import("vue");
  // the real composable applies a write on the client right away, so every
  // getPreference computed sees it; the version bump stands in for that
  const prefsVersion = ref(0);
  state.setPreferenceSpy.mockImplementation((key: string, value: unknown) => {
    state.prefs[key] = value;
    prefsVersion.value += 1;
  });
  return {
    useUserPreferences: () => ({
      getPreference: (key: string, defaultValue: unknown) =>
        computed(() => {
          void prefsVersion.value;
          // like the real one, only a missing key falls back: a stored null
          // reaches the palette as is
          return state.prefs[key] !== undefined
            ? state.prefs[key]
            : defaultValue;
        }),
      setPreference: state.setPreferenceSpy,
    }),
  };
});

const IconStub = { template: "<i />" };

vi.mock("@/components/navigation/utils/getMenuItems", () => ({
  getMenuItems: () => [
    {
      id: "discover",
      label: "discover",
      icon: { template: "<i />" },
      path: "/discover",
      isLibraryNode: false,
      group: "explore",
      hidden: false,
    },
    {
      id: "settings",
      label: "settings.settings",
      icon: { template: "<i />" },
      path: "/settings",
      isLibraryNode: true,
      group: "system",
      hidden: false,
    },
    {
      id: "hidden-page",
      label: "hidden_page",
      icon: { template: "<i />" },
      path: "/hidden",
      isLibraryNode: false,
      group: "explore",
      hidden: true,
    },
  ],
}));

const SPOTIFY_TARGET: SearchTarget = {
  id: "spotify",
  name: "Spotify",
  iconDomain: "spotify",
};
const FILES_TARGET: SearchTarget = {
  id: "filesystem_local--1",
  name: "Music files",
  iconDomain: "filesystem_local",
};

function makePlayer(id: string, name: string): Player {
  return {
    player_id: id,
    name,
    group_members: [],
    icon: "mdi-speaker",
  } as unknown as Player;
}

function makeTrack(id: string, name: string) {
  return {
    item_id: id,
    provider: "library",
    name,
    media_type: MediaType.TRACK,
    uri: `library://track/${id}`,
    artists: [],
  };
}

// the shell picks a sheet or a dialog by layout; the palette under test only
// hands it the open flag and a slot, so one stub covers both
const CommandCenterShellStub = {
  props: ["open"],
  emits: ["update:open"],
  template: '<div v-if="open" data-testid="command-center"><slot /></div>',
};
const ListboxFilterStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: `<input data-testid="palette-input" :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)" />`,
};
const CommandItemStub = {
  props: ["value"],
  emits: ["select"],
  template:
    '<button data-testid="palette-item" @click="$emit(\'select\')"><slot /></button>',
};

// reka renders the sources menu into a portal; these stubs keep it inline and
// open it from its trigger, so its items read and click like any other button
const DropdownMenuStub = {
  data: () => ({ open: false }),
  provide() {
    const menu = this as unknown as { open: boolean };
    return {
      toggleSourcesMenu: () => {
        menu.open = !menu.open;
      },
      sourcesMenuOpen: () => menu.open,
    };
  },
  template: "<div><slot /></div>",
};
const DropdownMenuTriggerStub = {
  inject: ["toggleSourcesMenu"],
  template: '<div @click="toggleSourcesMenu"><slot /></div>',
};
const DropdownMenuContentStub = {
  inject: ["sourcesMenuOpen"],
  emits: ["closeAutoFocus"],
  template:
    '<div v-if="sourcesMenuOpen()" data-testid="sources-menu"><slot /></div>',
};
const DropdownMenuCheckboxItemStub = {
  props: ["modelValue"],
  emits: ["update:modelValue", "select"],
  template: `<button role="menuitemcheckbox" :aria-checked="modelValue"
    @click="$emit('select', $event); $emit('update:modelValue', !modelValue)"><slot /></button>`,
};

function mountPalette(attachTo?: Element) {
  return mount(CommandCenter, {
    attachTo,
    global: {
      // the touch events plugin is not installed here; an empty definition
      // keeps the long press binding from warning
      directives: { hold: {} },
      stubs: {
        CommandCenterShell: CommandCenterShellStub,
        CommandList: { template: "<div><slot /></div>" },
        CommandGroup: {
          props: ["heading"],
          template: "<section><h3>{{ heading }}</h3><slot /></section>",
        },
        CommandItem: CommandItemStub,
        DropdownMenu: DropdownMenuStub,
        DropdownMenuTrigger: DropdownMenuTriggerStub,
        DropdownMenuContent: DropdownMenuContentStub,
        DropdownMenuLabel: { template: "<div><slot /></div>" },
        DropdownMenuSeparator: { template: "<hr />" },
        DropdownMenuCheckboxItem: DropdownMenuCheckboxItemStub,
        ListboxFilter: ListboxFilterStub,
        MediaItemThumb: IconStub,
        PlayerIcon: IconStub,
        ProviderIcon: {
          props: ["domain"],
          template: '<i data-testid="provider-icon" :data-domain="domain" />',
        },
        Spinner: { template: '<i data-testid="palette-spinner" />' },
      },
    },
  });
}

/** Submit the current query the way the search button does. */
async function submitSearch(wrapper: ReturnType<typeof mountPalette>) {
  // the button is hidden while scoped to pages, where results filter live
  const button = wrapper.find('button[aria-label="search"]');
  if (button.exists()) await button.trigger("click");
  await flushPromises();
}

async function typeQuery(
  wrapper: ReturnType<typeof mountPalette>,
  text: string,
) {
  await wrapper.get('[data-testid="palette-input"]').setValue(text);
  await submitSearch(wrapper);
}

/** The chip that narrows the palette to the app's own pages. */
function pagesChip(wrapper: ReturnType<typeof mountPalette>) {
  return wrapper
    .findAll("button.command-center-chip")
    .find((chip) => chip.text() === "pages")!;
}

/** The button at the end of the field that opens the sources menu. */
function sourcesTrigger(wrapper: ReturnType<typeof mountPalette>) {
  return wrapper.find('button[aria-label^="search_sources"]');
}

/** The items of the sources menu, "All sources" first, once it is open. */
function sourceItems(wrapper: ReturnType<typeof mountPalette>) {
  return wrapper.findAll('[role="menuitemcheckbox"]');
}

async function openSources(wrapper: ReturnType<typeof mountPalette>) {
  await sourcesTrigger(wrapper).trigger("click");
  return sourceItems(wrapper);
}

function sourceItem(wrapper: ReturnType<typeof mountPalette>, text: string) {
  const item = sourceItems(wrapper).find(
    (candidate) => candidate.text() === text,
  );
  expect(item, `source item "${text}"`).toBeDefined();
  return item!;
}

function checkedSources(wrapper: ReturnType<typeof mountPalette>) {
  return sourceItems(wrapper)
    .filter((item) => item.attributes("aria-checked") === "true")
    .map((item) => item.text());
}

/** Headings of the result groups currently rendered. */
function groupHeadings(wrapper: ReturnType<typeof mountPalette>) {
  return wrapper.findAll("section h3").map((heading) => heading.text());
}

/** Rows rendered for the track results, ignoring the "show more" row. */
function trackRowCount(wrapper: ReturnType<typeof mountPalette>) {
  return wrapper
    .findAll('[data-testid="palette-item"]')
    .filter((item) => item.text().startsWith("Track ")).length;
}

function itemByText(wrapper: ReturnType<typeof mountPalette>, text: string) {
  const item = wrapper
    .findAll('[data-testid="palette-item"]')
    .find((candidate) => candidate.text().includes(text));
  expect(item, `palette item containing "${text}"`).toBeDefined();
  return item!;
}

beforeEach(() => {
  vi.useFakeTimers();
  state.route.fullPath = "/";
  state.resultsByType = {};
  state.providersRef = undefined;
  state.providerTargets.value = [SPOTIFY_TARGET, FILES_TARGET];
  state.players = [];
  state.prefs = {};
  state.loading.value = false;
  state.storeMock.dialogActive = false;
  state.storeMock.activePlayerId = undefined;
  state.storeMock.mobileLayout = false;
  state.storeMock.isTouchscreen = false;
  vi.clearAllMocks();
});

afterEach(() => {
  useCommandCenter().close();
  vi.useRealTimers();
});

describe("CommandCenter", () => {
  it("toggles with the command hotkey and stays closed over other dialogs", async () => {
    const wrapper = mountPalette();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );
    await flushPromises();
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(true);

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true }),
    );
    await flushPromises();
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(false);

    // another dialog already open: the palette must not stack on top of it
    state.storeMock.dialogActive = true;
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true }),
    );
    await flushPromises();
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it("shows recent searches while the query is empty", async () => {
    state.prefs["search.recent"] = ["queen", "abba"];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    expect(wrapper.text()).toContain("recent_searches");
    expect(wrapper.text()).toContain("queen");
    expect(wrapper.text()).toContain("abba");

    wrapper.unmount();
  });

  it("groups media results, navigates on select and records the search", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "bohemian");
    expect(state.searchSpy).toHaveBeenCalledWith("bohemian");
    expect(wrapper.text()).toContain("tracks");

    await itemByText(wrapper, "Bohemian Rhapsody").trigger("click");
    expect(state.routerPush).toHaveBeenCalledWith({
      name: MediaType.TRACK,
      params: { itemId: "t1", provider: "library" },
    });
    expect(state.setPreferenceSpy).toHaveBeenCalledWith("search.recent", [
      "bohemian",
    ]);
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it("caps a section at five rows and reveals five more per click", async () => {
    state.resultsByType[MediaType.TRACK] = Array.from({ length: 12 }, (_, i) =>
      makeTrack(`t${i}`, `Track ${i}`),
    );
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "track");
    expect(trackRowCount(wrapper)).toBe(5);

    await wrapper.get("button.command-center-more").trigger("click");
    await flushPromises();
    expect(trackRowCount(wrapper)).toBe(10);

    // the last two rows leave nothing held back, so the row goes away
    await wrapper.get("button.command-center-more").trigger("click");
    await flushPromises();
    expect(trackRowCount(wrapper)).toBe(12);
    expect(wrapper.text()).not.toContain("show_more");

    wrapper.unmount();
  });

  it("drops the reveal back to five rows on the next query", async () => {
    state.resultsByType[MediaType.TRACK] = Array.from({ length: 12 }, (_, i) =>
      makeTrack(`t${i}`, `Track ${i}`),
    );
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "track");
    await wrapper.get("button.command-center-more").trigger("click");
    await flushPromises();
    expect(trackRowCount(wrapper)).toBe(10);

    await typeQuery(wrapper, "tracks");
    expect(trackRowCount(wrapper)).toBe(5);

    wrapper.unmount();
  });

  it("gives a single media type one long list instead of a show more row", async () => {
    state.resultsByType[MediaType.TRACK] = Array.from({ length: 30 }, (_, i) =>
      makeTrack(`t${i}`, `Track ${i}`),
    );
    const wrapper = mountPalette();
    useCommandCenter().open({ mediaTypes: [MediaType.TRACK] });
    await flushPromises();

    await typeQuery(wrapper, "track");
    // a page of rows, and scrolling to the end reveals the rest
    expect(trackRowCount(wrapper)).toBe(20);
    expect(wrapper.text()).not.toContain("show_more");

    wrapper.unmount();
  });

  it("plays a media result from its play button and shows the provider", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "bohemian");
    expect(wrapper.find('[data-testid="provider-icon"]').exists()).toBe(true);

    await wrapper.get("button.command-center-play").trigger("click");
    // plays directly instead of navigating to the details page
    expect(state.playBtnSpy).toHaveBeenCalledWith(
      state.resultsByType[MediaType.TRACK][0],
      expect.any(Number),
      expect.any(Number),
    );
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(state.setPreferenceSpy).toHaveBeenCalledWith("search.recent", [
      "bohemian",
    ]);
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it("opens the item menu on right click and keeps the palette up", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();
    await typeQuery(wrapper, "bohemian");

    await itemByText(wrapper, "Bohemian Rhapsody").trigger("contextmenu");

    expect(state.menuBtnSpy).toHaveBeenCalledWith(
      state.resultsByType[MediaType.TRACK][0],
      expect.any(Number),
      expect.any(Number),
    );
    // the menu opens on top of the palette, which stays where it is
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(true);
    expect(state.setPreferenceSpy).toHaveBeenCalledWith("search.recent", [
      "bohemian",
    ]);

    wrapper.unmount();
  });

  it("opens the item menu from the visible menu button", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();
    await typeQuery(wrapper, "bohemian");

    await wrapper.get('button[aria-label^="more_options"]').trigger("click");

    expect(state.menuBtnSpy).toHaveBeenCalledWith(
      state.resultsByType[MediaType.TRACK][0],
      expect.any(Number),
      expect.any(Number),
    );
    // the row itself is not selected, so the palette stays up
    expect(state.routerPush).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(true);

    wrapper.unmount();
  });

  it("closes when a menu action navigates away", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(true);

    state.route.fullPath = "/artist/123";
    await flushPromises();

    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it("shows at most five recent searches", async () => {
    state.prefs["search.recent"] = [
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    expect(wrapper.text()).toContain("five");
    expect(wrapper.text()).not.toContain("six");
    expect(wrapper.text()).not.toContain("seven");

    wrapper.unmount();
  });

  it("scopes results to the selected media type chip", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    state.resultsByType[MediaType.ARTIST] = [
      {
        item_id: "a1",
        provider: "library",
        name: "Queen",
        media_type: MediaType.ARTIST,
        uri: "library://artist/a1",
      },
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "queen");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");
    expect(wrapper.text()).toContain("Queen");

    const artistChip = wrapper
      .findAll("button.command-center-chip")
      .find((chip) => chip.text() === "artists");
    expect(artistChip).toBeDefined();
    await artistChip!.trigger("click");

    // only the chosen type remains; pages/players are media-irrelevant now
    expect(groupHeadings(wrapper)).toEqual(["artists"]);
    expect(wrapper.text()).toContain("Queen");
    expect(wrapper.text()).not.toContain("Bohemian Rhapsody");

    // clicking the active chip again restores the full view
    await artistChip!.trigger("click");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    wrapper.unmount();
  });

  it("collapses duplicate provider results by name and artist", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
      { ...makeTrack("t2", "Bohemian Rhapsody"), provider: "spotify" },
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "bohemian");
    const items = wrapper
      .findAll('[data-testid="palette-item"]')
      .filter((item) => item.text().includes("Bohemian Rhapsody"));
    expect(items).toHaveLength(1);

    wrapper.unmount();
  });

  it("shows a spinner while a submitted search is loading", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // a search is out and no results are in yet: spinner only
    state.loading.value = true;
    await typeQuery(wrapper, "bohemian");
    expect(wrapper.find('[data-testid="palette-spinner"]').exists()).toBe(true);

    // results land and the search settles: the spinner gives way to the rows
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    state.loading.value = false;
    state.bumpResults();
    await flushPromises();
    expect(wrapper.find('[data-testid="palette-spinner"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    wrapper.unmount();
  });

  it("shows the submit prompt, not a stale spinner, over a pending search", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // submit one term and leave its search pending
    state.loading.value = true;
    await typeQuery(wrapper, "aaa");
    expect(wrapper.find('[data-testid="palette-spinner"]').exists()).toBe(true);

    // typing a new term over it drops the old spinner and asks to submit again
    await wrapper.get('[data-testid="palette-input"]').setValue("bbb");
    expect(wrapper.find('[data-testid="palette-spinner"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("command_center_press_enter");

    wrapper.unmount();
  });

  it("searches only when submitted, not while typing", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // typing alone leaves the results hidden behind a prompt to submit
    await wrapper.get('[data-testid="palette-input"]').setValue("bohemian");
    expect(state.searchSpy).not.toHaveBeenCalledWith("bohemian");
    expect(wrapper.text()).not.toContain("Bohemian Rhapsody");
    expect(wrapper.text()).toContain("command_center_press_enter");

    await wrapper.get('button[aria-label="search"]').trigger("click");
    await flushPromises();
    expect(state.searchSpy).toHaveBeenCalledWith("bohemian");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    wrapper.unmount();
  });

  it("runs the search on the return key while the results are stale", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await wrapper.get('[data-testid="palette-input"]').setValue("bohemian");
    const input = wrapper.get('[data-testid="palette-input"]')
      .element as HTMLInputElement;
    const reachedInput: string[] = [];
    input.addEventListener("keydown", (event) => reachedInput.push(event.key));

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();

    expect(state.searchSpy).toHaveBeenCalledWith("bohemian");
    // the enter runs the search instead of opening a stale highlighted row
    expect(reachedInput).not.toContain("Enter");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    wrapper.unmount();
  });

  it("labels the return key as search or open by state", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // empty box: the return key opens the highlighted entry
    expect(wrapper.text()).toContain("command_center_open");
    expect(wrapper.text()).not.toContain("command_center_search");

    // typed but not submitted: the return key runs the search
    await wrapper.get('[data-testid="palette-input"]').setValue("bohemian");
    expect(wrapper.text()).toContain("command_center_search");

    // submitted: back to opening the top hit
    await submitSearch(wrapper);
    expect(wrapper.text()).not.toContain("command_center_search");
    expect(wrapper.text()).toContain("command_center_open");

    wrapper.unmount();
  });

  it("does not hijack enter from the toolbar buttons", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();
    await wrapper.get('[data-testid="palette-input"]').setValue("bohemian");

    // enter on the search-sources button must reach it, not start a search
    const button = sourcesTrigger(wrapper).element;
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(state.searchSpy).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("opens a highlighted row on enter instead of searching", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // pages scope has no search button, so the return key is the only way in
    await pagesChip(wrapper).trigger("click");
    await wrapper.get('[data-testid="palette-input"]').setValue("settings");

    // reka marks the arrow-highlighted row; stand that in on the rendered item
    wrapper
      .get('[data-testid="palette-item"]')
      .element.setAttribute("data-highlighted", "");

    const input = wrapper.get('[data-testid="palette-input"]')
      .element as HTMLInputElement;
    const reachedInput: string[] = [];
    input.addEventListener("keydown", (event) => reachedInput.push(event.key));

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();

    // the enter reaches reka to open the row rather than starting a search
    expect(reachedInput).toContain("Enter");
    expect(state.searchSpy).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("hints to keep typing when a single letter matches nothing", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await wrapper.get('[data-testid="palette-input"]').setValue("z");
    expect(wrapper.text()).toContain("command_center_keep_typing");

    wrapper.unmount();
  });

  it("filters recent searches by a sub-minimum query", async () => {
    state.prefs["search.recent"] = ["queen", "abba"];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await wrapper.get('[data-testid="palette-input"]').setValue("q");
    expect(wrapper.text()).toContain("queen");
    expect(wrapper.text()).not.toContain("abba");

    wrapper.unmount();
  });

  it("starts on the term and media type it was opened with", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open({
      query: "bohemian",
      mediaTypes: [MediaType.TRACK],
    });
    await flushPromises();

    expect(
      wrapper.get('[data-testid="palette-input"]').attributes("value"),
    ).toBe("bohemian");

    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(state.searchSpy).toHaveBeenLastCalledWith("bohemian");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    wrapper.unmount();
  });

  it("restores the previous search when it is reopened bare", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open({ query: "bohemian" });
    await flushPromises();
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    useCommandCenter().close();
    await flushPromises();

    // a bare reopen keeps the last term and its results instead of clearing
    useCommandCenter().open();
    await flushPromises();
    expect(
      wrapper.get('[data-testid="palette-input"]').attributes("value"),
    ).toBe("bohemian");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    wrapper.unmount();
  });

  it("clears the query from the field's own button", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // nothing to clear until there is something in the field
    expect(wrapper.find("button.command-center-clear").exists()).toBe(false);

    await typeQuery(wrapper, "bohemian");
    await wrapper.get("button.command-center-clear").trigger("click");

    expect(
      wrapper.get('[data-testid="palette-input"]').attributes("value"),
    ).toBe("");
    expect(wrapper.find("button.command-center-clear").exists()).toBe(false);

    wrapper.unmount();
  });

  // a query buries the pages under seven media sections, so the chip is the
  // way back to just them
  it("scopes to the app's own pages from the pages chip", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "disco");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    await pagesChip(wrapper).trigger("click");

    expect(groupHeadings(wrapper)).toEqual(["pages"]);
    expect(wrapper.text()).toContain("discover");
    expect(wrapper.text()).not.toContain("Bohemian Rhapsody");

    // and back out again
    await pagesChip(wrapper).trigger("click");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    wrapper.unmount();
  });

  it("asks no provider for a search while scoped to pages", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await pagesChip(wrapper).trigger("click");
    await typeQuery(wrapper, "settings");

    // pages are matched against the menu, so nothing goes out over the wire
    expect(state.searchSpy).not.toHaveBeenCalledWith("settings");
    expect(wrapper.text()).toContain("settings.settings");

    wrapper.unmount();
  });

  it("drops the pages scope when a media type is chosen", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await pagesChip(wrapper).trigger("click");
    const artistChip = wrapper
      .findAll("button.command-center-chip")
      .find((chip) => chip.text() === "artists");
    await artistChip!.trigger("click");

    expect(pagesChip(wrapper).attributes("data-active")).toBe("false");
    expect(artistChip!.attributes("data-active")).toBe("true");

    wrapper.unmount();
  });

  it("filters pages by the query and never lists hidden ones", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // empty query: all visible pages are offered
    expect(wrapper.text()).toContain("discover");
    expect(wrapper.text()).not.toContain("hidden_page");

    await typeQuery(wrapper, "settings");
    expect(wrapper.text()).toContain("settings.settings");
    expect(wrapper.text()).not.toContain("discover");

    await itemByText(wrapper, "settings.settings").trigger("click");
    expect(state.routerPush).toHaveBeenCalledWith("/settings");

    wrapper.unmount();
  });

  it("lists the library and each service in the sources menu", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // closed until asked for, and nothing picked yet: everything is searched
    expect(wrapper.find('[data-testid="sources-menu"]').exists()).toBe(false);
    expect(sourcesTrigger(wrapper).attributes("title")).toBe("search_sources");
    expect(sourcesTrigger(wrapper).text()).toBe("search_sources");

    const items = await openSources(wrapper);
    expect(items.map((item) => item.text())).toEqual([
      "all_sources",
      "library",
      "Spotify",
      "Music files",
    ]);
    expect(
      items
        .slice(1)
        .map((item) =>
          item.get('[data-testid="provider-icon"]').attributes("data-domain"),
        ),
    ).toEqual(["library", "spotify", "filesystem_local"]);
    expect(checkedSources(wrapper)).toEqual(["all_sources"]);

    wrapper.unmount();
  });

  it("leaves the sources menu out when there is nothing to pick from", async () => {
    state.providerTargets.value = [];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    expect(sourcesTrigger(wrapper).exists()).toBe(false);

    wrapper.unmount();
  });

  it("hides the sources menu while scoped to pages or to genres", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();
    expect(sourcesTrigger(wrapper).exists()).toBe(true);

    // pages come from the menu, not from a source
    await pagesChip(wrapper).trigger("click");
    expect(sourcesTrigger(wrapper).exists()).toBe(false);
    await pagesChip(wrapper).trigger("click");
    expect(sourcesTrigger(wrapper).exists()).toBe(true);

    // and genres only from the library
    const genresChip = wrapper
      .findAll("button.command-center-chip")
      .find((chip) => chip.text() === "genres")!;
    await genresChip.trigger("click");
    expect(sourcesTrigger(wrapper).exists()).toBe(false);

    wrapper.unmount();
  });

  it("narrows the search to the ticked sources and remembers them", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await openSources(wrapper);
    await sourceItem(wrapper, "Spotify").trigger("click");

    expect(state.setPreferenceSpy).toHaveBeenCalledWith("search.sources", [
      "spotify",
    ]);
    expect(state.providersRef?.value).toEqual(["spotify"]);
    // the menu stays open for the next tick
    expect(checkedSources(wrapper)).toEqual(["Spotify"]);
    expect(sourcesTrigger(wrapper).attributes("title")).toBe(
      "search_sources: Spotify",
    );
    expect(sourcesTrigger(wrapper).get("svg").classes()).toContain(
      "text-primary",
    );

    await sourceItem(wrapper, "library").trigger("click");
    expect(state.setPreferenceSpy).toHaveBeenLastCalledWith("search.sources", [
      "spotify",
      "library",
    ]);
    expect(checkedSources(wrapper)).toEqual(["library", "Spotify"]);
    expect(sourcesTrigger(wrapper).attributes("title")).toBe(
      "search_sources: library, Spotify",
    );

    wrapper.unmount();
  });

  it("ignores a remembered service that is gone and drops it on the next write", async () => {
    state.prefs["search.sources"] = ["tidal"];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    expect(sourcesTrigger(wrapper).attributes("title")).toBe("search_sources");
    expect(sourcesTrigger(wrapper).get("svg").classes()).not.toContain(
      "text-primary",
    );
    await openSources(wrapper);
    expect(checkedSources(wrapper)).toEqual(["all_sources"]);

    await sourceItem(wrapper, "Spotify").trigger("click");
    expect(state.setPreferenceSpy).toHaveBeenCalledWith("search.sources", [
      "spotify",
    ]);

    wrapper.unmount();
  });

  it("goes back to every source from All sources without rewriting an empty pick", async () => {
    state.prefs["search.sources"] = ["spotify"];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await openSources(wrapper);
    await sourceItem(wrapper, "all_sources").trigger("click");

    expect(state.setPreferenceSpy).toHaveBeenCalledWith("search.sources", []);
    expect(state.providersRef?.value).toEqual([]);
    expect(checkedSources(wrapper)).toEqual(["all_sources"]);

    state.setPreferenceSpy.mockClear();
    await sourceItem(wrapper, "all_sources").trigger("click");
    expect(state.setPreferenceSpy).not.toHaveBeenCalled();
    expect(checkedSources(wrapper)).toEqual(["all_sources"]);

    wrapper.unmount();
  });

  it("copes with a stored null selection", async () => {
    state.prefs["search.sources"] = null;
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    expect(state.providersRef?.value).toEqual([]);
    await openSources(wrapper);
    expect(checkedSources(wrapper)).toEqual(["all_sources"]);

    wrapper.unmount();
  });

  it("hands focus back to the field when the sources menu closes", async () => {
    const wrapper = mountPalette(document.body);
    useCommandCenter().open();
    await flushPromises();

    await openSources(wrapper);
    const input = wrapper.get('[data-testid="palette-input"]')
      .element as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);

    // reka's own default would put focus on the trigger button instead
    const closing = new Event("focusScope.autoFocusOnUnmount", {
      cancelable: true,
    });
    wrapper
      .findComponent(DropdownMenuContentStub)
      .vm.$emit("closeAutoFocus", closing);

    expect(closing.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);

    wrapper.unmount();
  });

  it("selects the active player by name", async () => {
    state.players = [makePlayer("p1", "Kitchen"), makePlayer("p2", "Bedroom")];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "kitch");
    expect(wrapper.text()).toContain("players");
    expect(wrapper.text()).not.toContain("Bedroom");

    await itemByText(wrapper, "Kitchen").trigger("click");
    expect(state.storeMock.activePlayerId).toBe("p1");
    expect(wrapper.find('[data-testid="command-center"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it("puts the on-screen keyboard away on enter instead of picking a result", async () => {
    state.storeMock.isTouchscreen = true;
    state.storeMock.mobileLayout = true;
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "bohemian");

    const input = wrapper.get('[data-testid="palette-input"]')
      .element as HTMLInputElement;
    const blurSpy = vi.spyOn(input, "blur");
    // reka's own enter handler sits on the input itself, so an enter that
    // reaches it would open the highlighted row
    const reachedInput: string[] = [];
    input.addEventListener("keydown", (event) => reachedInput.push(event.key));

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    expect(blurSpy).toHaveBeenCalled();
    expect(reachedInput).not.toContain("Enter");

    wrapper.unmount();
  });

  it("skips the first-result highlight on the mobile sheet", async () => {
    state.storeMock.isTouchscreen = true;
    state.storeMock.mobileLayout = true;
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    const seen: string[] = [];
    (
      wrapper.get('[data-testid="palette-input"]').element as HTMLInputElement
    ).addEventListener("keydown", (event) => seen.push(event.key));

    await typeQuery(wrapper, "bohemian");
    expect(wrapper.text()).toContain("Bohemian Rhapsody");
    // no synthetic ArrowDown: there is no enter contract to prepare for
    expect(seen).not.toContain("ArrowDown");

    wrapper.unmount();
  });

  it("leaves the enter that commits an IME conversion to the composition", async () => {
    state.storeMock.isTouchscreen = true;
    state.storeMock.mobileLayout = true;
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "bohemian");

    const input = wrapper.get('[data-testid="palette-input"]')
      .element as HTMLInputElement;
    const blurSpy = vi.spyOn(input, "blur");
    const reachedInput: string[] = [];
    input.addEventListener("keydown", (event) => reachedInput.push(event.key));

    // this enter picks the IME candidate; it is not a return-key press
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        isComposing: true,
      }),
    );

    expect(blurSpy).not.toHaveBeenCalled();
    expect(reachedInput).toContain("Enter");

    wrapper.unmount();
  });

  it("keeps the desktop enter contract on a touchscreen laptop", async () => {
    // a touch screen with the desktop dialog: the footer still advertises
    // enter, so it must keep opening the top hit
    state.storeMock.isTouchscreen = true;
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    const input = wrapper.get('[data-testid="palette-input"]')
      .element as HTMLInputElement;
    const seen: string[] = [];
    input.addEventListener("keydown", (event) => seen.push(event.key));

    await typeQuery(wrapper, "bohemian");
    expect(seen).toContain("ArrowDown");

    const blurSpy = vi.spyOn(input, "blur");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(blurSpy).not.toHaveBeenCalled();
    expect(seen).toContain("Enter");

    wrapper.unmount();
  });

  it("highlights the first result on desktop and leaves focus alone on enter", async () => {
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    const input = wrapper.get('[data-testid="palette-input"]')
      .element as HTMLInputElement;
    const seen: string[] = [];
    input.addEventListener("keydown", (event) => seen.push(event.key));

    await typeQuery(wrapper, "bohemian");
    // the synthetic ArrowDown that highlights the top hit for enter to open
    expect(seen).toContain("ArrowDown");

    const blurSpy = vi.spyOn(input, "blur");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(blurSpy).not.toHaveBeenCalled();
    expect(seen).toContain("Enter");

    wrapper.unmount();
  });

  it("keeps the search when the palette closes", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "bohemian");
    useCommandCenter().close();
    await flushPromises();

    // the search is not reset on close, so it is there on the next open
    expect(state.searchSpy).not.toHaveBeenCalledWith("");
    expect(state.storeMock.dialogActive).toBe(false);

    wrapper.unmount();
  });
});
