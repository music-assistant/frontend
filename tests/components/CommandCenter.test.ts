import CommandCenter from "@/components/CommandCenter.vue";
import { useCommandCenter } from "@/composables/useCommandCenter";
import { MediaType, type Player } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  resultsByType: {} as Record<string, unknown[]>,
  // real search results arrive through reactive state; tests emulate that by
  // bumping this after mutating resultsByType outside a query change
  bumpResults: () => {},
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
  return {
    ...actual,
    useProgressiveSearch: () => ({
      loading: computed(() => state.loading.value),
      search: state.searchSpy,
      filteredItems: (mediaType: string) => {
        void resultsVersion.value;
        return state.resultsByType[mediaType] ?? [];
      },
    }),
  };
});

vi.mock("@/composables/useOrderedPlayers", async () => {
  const { computed } = await import("vue");
  return {
    useOrderedPlayers: () => computed(() => state.players),
  };
});

vi.mock("@/composables/userPreferences", async () => {
  const { computed } = await import("vue");
  return {
    useUserPreferences: () => ({
      getPreference: (key: string, defaultValue: unknown) =>
        computed(() => state.prefs[key] ?? defaultValue),
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

function mountPalette() {
  return mount(CommandCenter, {
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
        ListboxFilter: ListboxFilterStub,
        MediaItemThumb: IconStub,
        PlayerIcon: IconStub,
        ProviderIcon: { template: '<i data-testid="provider-icon" />' },
        Spinner: { template: '<i data-testid="palette-spinner" />' },
      },
    },
  });
}

async function typeQuery(
  wrapper: ReturnType<typeof mountPalette>,
  text: string,
) {
  await wrapper.get('[data-testid="palette-input"]').setValue(text);
  vi.advanceTimersByTime(300);
  await flushPromises();
}

/** The chip that narrows the palette to the app's own pages. */
function pagesChip(wrapper: ReturnType<typeof mountPalette>) {
  return wrapper
    .findAll("button.command-center-chip")
    .find((chip) => chip.text() === "pages")!;
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

  it("spins while searching and keeps the results up on the next keystroke", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // keystroke landed but the debounced search hasn't fired yet and no
    // results are in: spinner only
    await wrapper.get('[data-testid="palette-input"]').setValue("bo");
    expect(wrapper.find('[data-testid="palette-spinner"]').exists()).toBe(true);

    // results land; the next keystroke keeps them visible (no spinner)
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    state.bumpResults();
    vi.advanceTimersByTime(300);
    await wrapper.get('[data-testid="palette-input"]').setValue("boh");
    expect(wrapper.find('[data-testid="palette-spinner"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("Bohemian Rhapsody");

    vi.advanceTimersByTime(300);
    await flushPromises();
    expect(state.searchSpy).toHaveBeenLastCalledWith("boh");

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

  it("clears the handed-over term when it is reopened bare", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open({ query: "bohemian" });
    await flushPromises();
    useCommandCenter().close();
    await flushPromises();

    useCommandCenter().open();
    await flushPromises();
    expect(
      wrapper.get('[data-testid="palette-input"]').attributes("value"),
    ).toBe("");

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

  it("clears the query when the palette closes", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "bohemian");
    useCommandCenter().close();
    await flushPromises();

    expect(state.searchSpy).toHaveBeenLastCalledWith("");
    expect(state.storeMock.dialogActive).toBe(false);

    wrapper.unmount();
  });
});
