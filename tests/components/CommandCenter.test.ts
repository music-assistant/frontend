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
  playBtnSpy: vi.fn(),
  loading: { value: false },
  storeMock: {
    isTouchscreen: false,
    dialogActive: false,
    activePlayerId: undefined as string | undefined,
    globalSearchTerm: undefined as string | undefined,
    globalSearchMediaTypes: [] as string[],
  },
}));

vi.mock("@/plugins/store", () => ({
  store: state.storeMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: state.routerPush }),
}));

vi.mock("@/plugins/api", () => {
  const apiMock = { players: {} };
  return { api: apiMock, default: apiMock };
});

vi.mock("@/helpers/media_item_actions", () => ({
  handlePlayBtnClick: state.playBtnSpy,
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

const CommandDialogStub = {
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
      stubs: {
        CommandDialog: CommandDialogStub,
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

function itemByText(wrapper: ReturnType<typeof mountPalette>, text: string) {
  const item = wrapper
    .findAll('[data-testid="palette-item"]')
    .find((candidate) => candidate.text().includes(text));
  expect(item, `palette item containing "${text}"`).toBeDefined();
  return item!;
}

beforeEach(() => {
  vi.useFakeTimers();
  state.resultsByType = {};
  state.players = [];
  state.prefs = {};
  state.loading.value = false;
  state.storeMock.dialogActive = false;
  state.storeMock.activePlayerId = undefined;
  state.storeMock.globalSearchTerm = undefined;
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
    expect(wrapper.text()).toContain("Queen");
    expect(wrapper.text()).not.toContain("Bohemian Rhapsody");
    expect(wrapper.text()).not.toContain("pages");

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

  it("shows a spinner instead of flashing 'see all results' while searching", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    // keystroke landed but the debounced search hasn't fired yet and no
    // results are in: spinner only, no premature "see all results"
    await wrapper.get('[data-testid="palette-input"]').setValue("bo");
    expect(wrapper.find('[data-testid="palette-spinner"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("see_all_results");

    // results land; the next keystroke keeps them visible (no spinner) and
    // the see-all handoff is offered
    state.resultsByType[MediaType.TRACK] = [
      makeTrack("t1", "Bohemian Rhapsody"),
    ];
    state.bumpResults();
    vi.advanceTimersByTime(300);
    await wrapper.get('[data-testid="palette-input"]').setValue("boh");
    expect(wrapper.find('[data-testid="palette-spinner"]').exists()).toBe(
      false,
    );
    expect(wrapper.text()).toContain("see_all_results");
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
    expect(wrapper.text()).not.toContain("see_all_results");

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

  it("hands the query over to the full search page", async () => {
    const wrapper = mountPalette();
    useCommandCenter().open();
    await flushPromises();

    await typeQuery(wrapper, "bohemian");
    await itemByText(wrapper, "see_all_results").trigger("click");

    expect(state.storeMock.globalSearchTerm).toBe("bohemian");
    expect(state.routerPush).toHaveBeenCalledWith({ name: "search" });

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
