import PlayerSelect from "@/layouts/default/PlayerSelect.vue";
import {
  fullscreenPlayerSelectAnchor,
  playerBarEndAnchor,
} from "@/helpers/player_bar";
import { api } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { emitEvent, getPreference, isAdmin, preferenceState, setPreference } =
  vi.hoisted(() => ({
    emitEvent: vi.fn(),
    getPreference: vi.fn(),
    isAdmin: vi.fn(() => true),
    preferenceState: {
      values: {} as Record<string, unknown>,
      reactiveValues: undefined as Record<string, unknown> | undefined,
    },
    setPreference: vi.fn(),
  }));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    // the menu's ai dj entry derives availability from the provider list
    providers: {},
  });
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { computed, reactive } =
    await vi.importActual<typeof import("vue")>("vue");
  const { api } = await import("@/plugins/api");
  return {
    store: reactive({
      // resolved from the player list like the real store, so the guard against
      // overriding an existing selection behaves the same
      activePlayer: computed(() =>
        store.activePlayerId ? api.players[store.activePlayerId] : undefined,
      ),
      activePlayerId: undefined as string | undefined,
      companionPlayerId: undefined as string | undefined,
      dialogActive: false,
      isTouchscreen: false,
      mobileLayout: false,
      showFullscreenPlayer: false,
      showPlayersMenu: true,
    }),
  };
});

vi.mock("@/plugins/web_player", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    webPlayer: reactive({
      player_id: null as string | null,
    }),
  };
});

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    emit: emitEvent,
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isAdmin,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/composables/userPreferences", async () => {
  const { computed, reactive } =
    await vi.importActual<typeof import("vue")>("vue");
  const reactiveValues = reactive(preferenceState.values);
  preferenceState.reactiveValues = reactiveValues;
  getPreference.mockImplementation((key: string, defaultValue?: unknown) =>
    computed(() =>
      key in reactiveValues ? reactiveValues[key] : defaultValue,
    ),
  );
  setPreference.mockImplementation(async (key: string, value: unknown) => {
    reactiveValues[key] = value;
  });
  return {
    useUserPreferences: () => ({
      getPreference,
      setPreference,
    }),
  };
});

vi.mock("@/helpers/players", () => ({
  groupMemberPickerVisible: () => true,
  isBuiltinPlayer: (player: Player) => player.player_id === "builtin",
  isPlayerActive: (player: Player) =>
    player.playback_state === PlaybackState.PLAYING ||
    player.playback_state === PlaybackState.PAUSED,
  playerVisible: () => true,
}));

const PlayerCardStub = {
  props: [
    "player",
    "showVolumeControl",
    "showChildVolumes",
    "showMemberControls",
    "showGroupControls",
    "showDisabledGroupControl",
    "showGroupMemberNames",
    "groupMemberLayout",
    "stackMediaDetails",
    "groupControlExpanded",
    "groupControlsId",
    "showSelectedIndicator",
  ],
  emits: ["click", "toggle-child-volumes", "toggle-member-controls"],
  template: `
    <article
      class="player-card"
      :data-player-id="player.player_id"
      :data-volume-control="showVolumeControl ? 'true' : 'false'"
      :data-child-volumes="showChildVolumes ? 'true' : 'false'"
      :data-member-controls="showMemberControls ? 'true' : 'false'"
      :data-disabled-group-control="showDisabledGroupControl ? 'true' : 'false'"
      :data-group-member-names="showGroupMemberNames ? 'true' : 'false'"
      :data-group-member-layout="groupMemberLayout"
      :data-stack-media-details="stackMediaDetails ? 'true' : 'false'"
      :data-group-control-expanded="groupControlExpanded ? 'true' : 'false'"
      :data-selected-indicator="showSelectedIndicator ? 'true' : 'false'"
    >
      <button class="select-player" @click="$emit('click', player)">
        {{ player.name }}
      </button>
      <button
        class="volume-toggle"
        @click="$emit('toggle-child-volumes', player)"
      />
      <button
        class="member-toggle"
        data-player-group-control
        @click="$emit('toggle-member-controls', player, $event.currentTarget)"
      />
    </article>
  `,
};

const SearchInputStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: `
    <input
      class="player-search"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
};

const passthroughStub = { template: "<div><slot /></div>" };
const DropdownMenuCheckboxItemStub = {
  props: ["modelValue"],
  emits: ["select", "update:modelValue"],
  template: `
    <button
      class="preference-toggle"
      @click="$emit('update:modelValue', !modelValue)"
    >
      <slot />
    </button>
  `,
};
const PopoverAnchorStub = {
  name: "PopoverAnchor",
  props: ["reference"],
  template: `<div><slot /></div>`,
};
// deliberately not focusable: where the panel puts its opening focus depends on
// the markup reka renders around it, so those tests mount the real popover
const PopoverContentStub = {
  name: "PopoverContent",
  emits: ["interact-outside"],
  template: `<div><slot /></div>`,
};

function createPlayer(
  playerId: string,
  name: string,
  playbackState = PlaybackState.IDLE,
): Player {
  return {
    player_id: playerId,
    provider: "test",
    type: PlayerType.PLAYER,
    name,
    available: true,
    device_info: {
      model: "Test",
      manufacturer: "Test",
      software_version: null,
      model_id: null,
      manufacturer_id: null,
      identifiers: {
        [IdentifierType.MAC_ADDRESS]: "",
        [IdentifierType.SERIAL_NUMBER]: "",
        [IdentifierType.UUID]: "",
        [IdentifierType.IP_ADDRESS]: "",
        [IdentifierType.UNKNOWN]: "",
      },
    },
    supported_features: [],
    can_group_with: [],
    enabled: true,
    playback_state: playbackState,
    powered: true,
    volume_level: 25,
    volume_muted: false,
    group_members: [],
    static_group_members: [],
    source_list: [],
    sound_mode_list: [],
    options: [],
    group_volume: null,
    group_volume_muted: null,
    hide_in_ui: false,
    private: false,
    icon: "speaker",
    power_control: "power",
    volume_control: "volume",
    mute_control: "mute",
    needs_setup: false,
    has_setup_flow: false,
    output_protocols: [],
    active_output_protocol: null,
    elapsed_time: null,
    elapsed_time_last_updated: null,
    current_media: null,
    active_source: null,
    active_sound_mode: null,
    active_group: null,
    synced_to: null,
    sleep_timer_expires_at: null,
  };
}

// enough players for the panel to show its search field
function manyPlayers(): Record<string, Player> {
  return Object.fromEntries(
    Array.from({ length: 11 }, (_, index) => {
      const player = createPlayer(`player-${index}`, `Player ${index}`);
      return [player.player_id, player];
    }),
  );
}

// resolves with the panel once reka has mounted it and settled its focus
function findOpenPanel() {
  return vi.waitFor(() => {
    const panel = document.body.querySelector(
      '[data-testid="player-select-sheet"]',
    );
    expect(panel).not.toBeNull();
    expect(panel!.contains(document.activeElement)).toBe(true);
    return panel!;
  });
}

function setPlayerSelectPreference(key: string, value: boolean | string) {
  if (!preferenceState.reactiveValues) {
    throw new Error("Preference mock is not initialized");
  }
  preferenceState.reactiveValues[key] = value;
}

function setActivePlayerPreference(value: string) {
  setPlayerSelectPreference("activePlayerId", value);
}

function mountPlayerSelect() {
  return mount(PlayerSelect, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        PlayerCard: PlayerCardStub,
        SearchInput: SearchInputStub,
        DropdownMenu: passthroughStub,
        DropdownMenuCheckboxItem: DropdownMenuCheckboxItemStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuItem: passthroughStub,
        DropdownMenuLabel: passthroughStub,
        DropdownMenuSeparator: passthroughStub,
        DropdownMenuTrigger: passthroughStub,
        Popover: passthroughStub,
        PopoverAnchor: PopoverAnchorStub,
        PopoverContent: PopoverContentStub,
        Teleport: true,
      },
    },
  });
}

// the popover components render for real here, so the panel goes through
// reka-ui's own labelling rather than a stub that echoes whatever it is passed
function mountPlayerSelectWithPopover() {
  return mount(PlayerSelect, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        PlayerCard: PlayerCardStub,
        SearchInput: SearchInputStub,
        DropdownMenu: passthroughStub,
        DropdownMenuCheckboxItem: DropdownMenuCheckboxItemStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuItem: passthroughStub,
        DropdownMenuLabel: passthroughStub,
        DropdownMenuSeparator: passthroughStub,
        DropdownMenuTrigger: passthroughStub,
      },
    },
  });
}

describe("PlayerSelect", () => {
  // the store and api mocks are module singletons, so a component left mounted
  // keeps reacting to the next test's state
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    const preferenceValues = preferenceState.reactiveValues;
    if (preferenceValues) {
      for (const key of Object.keys(preferenceValues)) {
        delete preferenceValues[key];
      }
    }
    api.players = {};
    store.activePlayerId = undefined;
    store.companionPlayerId = undefined;
    store.dialogActive = false;
    store.isTouchscreen = false;
    store.mobileLayout = false;
    store.showFullscreenPlayer = false;
    store.showPlayersMenu = true;
    webPlayer.player_id = null;
  });

  it("orders the selected player, this device, then active players first", () => {
    const activePlayer = createPlayer("active", "Kitchen");
    api.players = {
      office: createPlayer("office", "Office"),
      bedroom: createPlayer("bedroom", "Bedroom", PlaybackState.PAUSED),
      active: activePlayer,
      builtin: createPlayer("builtin", "This device"),
      attic: createPlayer("attic", "Attic", PlaybackState.PLAYING),
      lounge: createPlayer("lounge", "Lounge"),
    };
    store.activePlayerId = activePlayer.player_id;

    const wrapper = mountPlayerSelect();

    expect(
      wrapper
        .findAll(".player-card")
        .map((card) => card.attributes("data-player-id")),
    ).toEqual(["active", "builtin", "attic", "bedroom", "lounge", "office"]);
  });

  it("leaves the selected player in normal list order when pinning is disabled", () => {
    setPlayerSelectPreference("playerSelect.showSelectedPlayerFirst", false);
    setPlayerSelectPreference("playerSelect.showActivePlayersFirst", false);
    const selectedPlayer = createPlayer("selected", "Office");
    api.players = {
      kitchen: createPlayer("kitchen", "Kitchen"),
      selected: selectedPlayer,
      attic: createPlayer("attic", "Attic"),
    };
    store.activePlayerId = selectedPlayer.player_id;

    const wrapper = mountPlayerSelect();

    expect(
      wrapper
        .findAll(".player-card")
        .map((card) => card.attributes("data-player-id")),
    ).toEqual(["attic", "kitchen", "selected"]);
  });

  it("leaves active players in normal list order when prioritizing is disabled", () => {
    setPlayerSelectPreference("playerSelect.showSelectedPlayerFirst", false);
    setPlayerSelectPreference("playerSelect.showActivePlayersFirst", false);
    api.players = {
      office: createPlayer("office", "Office", PlaybackState.PLAYING),
      bedroom: createPlayer("bedroom", "Bedroom", PlaybackState.PAUSED),
      attic: createPlayer("attic", "Attic"),
    };

    const wrapper = mountPlayerSelect();

    expect(
      wrapper
        .findAll(".player-card")
        .map((card) => card.attributes("data-player-id")),
    ).toEqual(["attic", "bedroom", "office"]);
  });

  it("waits for a remembered player instead of selecting the web player", async () => {
    const web = createPlayer("web", "This device");
    const remembered = createPlayer("remembered", "Living room");
    setActivePlayerPreference(remembered.player_id);
    webPlayer.player_id = web.player_id;
    api.players = {
      [web.player_id]: web,
    };

    mountPlayerSelect();
    expect(store.activePlayerId).toBeUndefined();

    api.players[remembered.player_id] = remembered;
    await nextTick();

    expect(store.activePlayerId).toBe(remembered.player_id);
  });

  it("waits for the built-in player when it is the remembered one", async () => {
    const builtin = createPlayer("builtin", "This device");
    const kitchen = createPlayer("kitchen", "Kitchen", PlaybackState.PLAYING);
    setActivePlayerPreference("<builtinplayer>");
    api.players = { [kitchen.player_id]: kitchen };

    mountPlayerSelect();
    expect(store.activePlayerId).toBeUndefined();

    api.players[builtin.player_id] = builtin;
    webPlayer.player_id = builtin.player_id;
    await nextTick();

    expect(store.activePlayerId).toBe(builtin.player_id);
  });

  it("falls back to the built-in player, then a playing one, then any", async () => {
    const attic = createPlayer("attic", "Attic");
    const kitchen = createPlayer("kitchen", "Kitchen", PlaybackState.PLAYING);
    const builtin = createPlayer("builtin", "This device");
    api.players = { [attic.player_id]: attic };

    mountPlayerSelect();
    expect(store.activePlayerId).toBe(attic.player_id);

    api.players[kitchen.player_id] = kitchen;
    store.activePlayerId = undefined;
    await nextTick();
    expect(store.activePlayerId).toBe(kitchen.player_id);

    api.players[builtin.player_id] = builtin;
    webPlayer.player_id = builtin.player_id;
    store.activePlayerId = undefined;
    await nextTick();
    expect(store.activePlayerId).toBe(builtin.player_id);
  });

  it("remembers a selected player but not an automatic one", async () => {
    const kitchen = createPlayer("kitchen", "Kitchen");
    const office = createPlayer("office", "Office");
    api.players = {
      [kitchen.player_id]: kitchen,
      [office.player_id]: office,
    };

    const wrapper = mountPlayerSelect();
    expect(store.activePlayerId).toBe(kitchen.player_id);
    expect(setPreference).not.toHaveBeenCalled();

    await wrapper
      .get('[data-player-id="office"] .select-player')
      .trigger("click");

    expect(setPreference).toHaveBeenCalledWith(
      "activePlayerId",
      office.player_id,
    );
  });

  it("remembers the built-in player as a device independent placeholder", async () => {
    const builtin = createPlayer("builtin", "This device");
    const kitchen = createPlayer("kitchen", "Kitchen");
    setActivePlayerPreference(kitchen.player_id);
    api.players = {
      [builtin.player_id]: builtin,
      [kitchen.player_id]: kitchen,
    };
    const wrapper = mountPlayerSelect();

    await wrapper
      .get('[data-player-id="builtin"] .select-player')
      .trigger("click");

    expect(setPreference).toHaveBeenCalledWith(
      "activePlayerId",
      "<builtinplayer>",
    );
  });

  it("remembers the player that was already selected automatically", async () => {
    const kitchen = createPlayer("kitchen", "Kitchen");
    api.players = { [kitchen.player_id]: kitchen };
    const wrapper = mountPlayerSelect();
    expect(store.activePlayerId).toBe(kitchen.player_id);

    await wrapper
      .get('[data-player-id="kitchen"] .select-player')
      .trigger("click");

    expect(setPreference).toHaveBeenCalledWith(
      "activePlayerId",
      kitchen.player_id,
    );
  });

  it("replaces a remembered built-in player id with the placeholder", async () => {
    const builtin = createPlayer("builtin", "This device");
    setActivePlayerPreference(builtin.player_id);
    api.players = { [builtin.player_id]: builtin };

    mountPlayerSelect();

    expect(store.activePlayerId).toBe(builtin.player_id);
    expect(setPreference).toHaveBeenCalledWith(
      "activePlayerId",
      "<builtinplayer>",
    );
  });

  it("hands an automatic pick over to the built-in player registering late", async () => {
    const attic = createPlayer("attic", "Attic");
    const builtin = createPlayer("builtin", "This device");
    api.players = { [attic.player_id]: attic };

    mountPlayerSelect();
    expect(store.activePlayerId).toBe(attic.player_id);

    api.players[builtin.player_id] = builtin;
    store.companionPlayerId = builtin.player_id;
    await nextTick();

    expect(store.activePlayerId).toBe(builtin.player_id);
    expect(setPreference).not.toHaveBeenCalled();
  });

  it("keeps the remembered player when it is unavailable at startup", () => {
    const kitchen = createPlayer("kitchen", "Kitchen");
    kitchen.available = false;
    const attic = createPlayer("attic", "Attic");
    setActivePlayerPreference(kitchen.player_id);
    api.players = {
      [kitchen.player_id]: kitchen,
      [attic.player_id]: attic,
    };

    mountPlayerSelect();

    expect(store.activePlayerId).toBe(attic.player_id);
    expect(setPreference).not.toHaveBeenCalled();
  });

  it("keeps a remembered player when the built-in one registers late", async () => {
    const kitchen = createPlayer("kitchen", "Kitchen");
    const builtin = createPlayer("builtin", "This device");
    setActivePlayerPreference(kitchen.player_id);
    api.players = { [kitchen.player_id]: kitchen };

    mountPlayerSelect();
    expect(store.activePlayerId).toBe(kitchen.player_id);

    api.players[builtin.player_id] = builtin;
    webPlayer.player_id = builtin.player_id;
    await nextTick();

    expect(store.activePlayerId).toBe(kitchen.player_id);
    expect(setPreference).not.toHaveBeenCalled();
  });

  it("moves a newly active player to the front", async () => {
    const kitchen = createPlayer("kitchen", "Kitchen");
    const office = createPlayer("office", "Office");
    api.players = {
      [kitchen.player_id]: kitchen,
      [office.player_id]: office,
    };
    const wrapper = mountPlayerSelect();

    store.activePlayerId = office.player_id;
    await nextTick();

    expect(
      wrapper
        .findAll(".player-card")
        .map((card) => card.attributes("data-player-id")),
    ).toEqual(["office", "kitchen"]);
  });

  it("shows search only when more than ten players are visible", () => {
    api.players = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => {
        const player = createPlayer(`player-${index}`, `Player ${index}`);
        return [player.player_id, player];
      }),
    );

    const tenPlayers = mountPlayerSelect();
    expect(tenPlayers.find(".player-search").exists()).toBe(false);
    tenPlayers.unmount();

    const extraPlayer = createPlayer("player-10", "Player 10");
    api.players[extraPlayer.player_id] = extraPlayer;

    const elevenPlayers = mountPlayerSelect();
    expect(elevenPlayers.find(".player-search").exists()).toBe(true);
  });

  it("filters the ordered list by player name", async () => {
    api.players = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => {
        const name = index === 7 ? "Living room" : `Player ${index}`;
        const player = createPlayer(`player-${index}`, name);
        return [player.player_id, player];
      }),
    );
    const wrapper = mountPlayerSelect();

    await wrapper.find(".player-search").setValue("living");

    expect(
      wrapper
        .findAll(".player-card")
        .map((card) => card.attributes("data-player-id")),
    ).toEqual(["player-7"]);
  });

  it("selects a player and closes the sheet from the card action", async () => {
    const player = createPlayer("kitchen", "Kitchen");
    const other = createPlayer("attic", "Attic");
    api.players = { [player.player_id]: player, [other.player_id]: other };
    const wrapper = mountPlayerSelect();
    expect(store.activePlayerId).toBe(other.player_id);

    await wrapper
      .get('[data-player-id="kitchen"] .select-player')
      .trigger("click");

    expect(store.activePlayerId).toBe(player.player_id);
    expect(store.showPlayersMenu).toBe(false);
  });

  it("starts setup instead of selecting a setup-required player", async () => {
    const player = createPlayer("kitchen", "Kitchen");
    player.available = false;
    player.needs_setup = true;
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();

    await wrapper.find(".select-player").trigger("click");

    expect(store.activePlayerId).toBeUndefined();
    expect(store.showPlayersMenu).toBe(false);
    expect(emitEvent).toHaveBeenCalledWith("setupFlowDialog", {
      kind: "player",
      playerId: player.player_id,
    });
  });

  it("enables the detailed card layout only in the selector", () => {
    const player = createPlayer("kitchen", "Kitchen");
    api.players = { [player.player_id]: player };

    const wrapper = mountPlayerSelect();

    expect(
      wrapper.find(".player-card").attributes("data-group-member-names"),
    ).toBe("true");
    expect(
      wrapper.find(".player-card").attributes("data-group-member-layout"),
    ).toBe("subtitle-list");
    expect(
      wrapper.find(".player-card").attributes("data-stack-media-details"),
    ).toBe("true");
    expect(
      wrapper.find(".player-card").attributes("data-disabled-group-control"),
    ).toBe("true");
    expect(
      wrapper.find(".player-card").attributes("data-selected-indicator"),
    ).toBe("true");
  });

  it("keeps the cards inside the list that scrolls", () => {
    api.players = {
      kitchen: createPlayer("kitchen", "Kitchen"),
      office: createPlayer("office", "Office"),
    };

    const scroller = mountPlayerSelect().get(".player-volume-scroller");

    // this class is what PlayerVolume reaches the volume rows on these cards
    // through; a card rendered outside it would silently lose the pan
    expect(scroller.classes()).toContain("overflow-y-auto");
    expect(scroller.findAll(".player-card")).toHaveLength(2);
  });

  it("shows volume controls only for playing and paused players by default", () => {
    api.players = {
      idle: createPlayer("idle", "Idle"),
      paused: createPlayer("paused", "Paused", PlaybackState.PAUSED),
      playing: createPlayer("playing", "Playing", PlaybackState.PLAYING),
    };

    const wrapper = mountPlayerSelect();
    const volumeVisibility = Object.fromEntries(
      wrapper
        .findAll(".player-card")
        .map((card) => [
          card.attributes("data-player-id"),
          card.attributes("data-volume-control"),
        ]),
    );

    expect(volumeVisibility).toEqual({
      idle: "false",
      paused: "true",
      playing: "true",
    });
  });

  it("can hide grouped-player sublines", () => {
    setPlayerSelectPreference("playerSelect.showGroupMemberNames", false);
    const player = createPlayer("kitchen", "Kitchen");
    api.players = { [player.player_id]: player };

    const wrapper = mountPlayerSelect();

    expect(
      wrapper.find(".player-card").attributes("data-group-member-names"),
    ).toBe("false");
  });

  it("persists display options as user preferences", async () => {
    const wrapper = mountPlayerSelect();
    const toggles = wrapper.findAll(".preference-toggle");

    await toggles[0].trigger("click");
    await toggles[1].trigger("click");
    await toggles[2].trigger("click");
    await toggles[3].trigger("click");

    expect(setPreference).toHaveBeenCalledWith(
      "playerSelect.showSelectedPlayerFirst",
      false,
    );
    expect(setPreference).toHaveBeenCalledWith(
      "playerSelect.showActivePlayersFirst",
      false,
    );
    expect(setPreference).toHaveBeenCalledWith(
      "playerSelect.showGroupMemberNames",
      false,
    );
    expect(setPreference).toHaveBeenCalledWith(
      "playerSelect.showVolumeForActivePlayersOnly",
      false,
    );
  });

  it("closes from the blurred backdrop", async () => {
    const player = createPlayer("kitchen", "Kitchen");
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();

    await wrapper.find(".player-select-backdrop").trigger("click");

    expect(store.showPlayersMenu).toBe(false);
  });

  it("names the panel for assistive tech", async () => {
    // reka-ui names a panel after its PopoverTrigger, and this popout is
    // anchored instead of triggered, so only a real mount shows the name lands
    const wrapper = mountPlayerSelectWithPopover();
    await nextTick();

    const panel = document.body.querySelector(
      '[data-testid="player-select-sheet"]',
    );
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-label")).toBe("players");

    wrapper.unmount();
  });

  it("stops above the bottom navigation in mobile layout", () => {
    store.mobileLayout = true;

    const wrapper = mountPlayerSelect();

    expect(wrapper.find(".player-select-backdrop").classes()).toContain(
      "player-select-mobile-offset",
    );
    const sheet = wrapper.find('[data-testid="player-select-sheet"]');
    expect(sheet.classes()).toContain("player-select-popover");
    expect(sheet.attributes("align")).toBe("end");
    expect(wrapper.findComponent(PopoverAnchorStub).props("reference")).toBe(
      playerBarEndAnchor,
    );
  });

  it("pops out of the fullscreen player instead of behind it", () => {
    store.mobileLayout = true;
    store.showFullscreenPlayer = true;

    const wrapper = mountPlayerSelect();

    const backdrop = wrapper.find(".player-select-backdrop");
    expect(backdrop.classes()).toContain("player-select-fullscreen-backdrop");
    // the fullscreen offset replaces the layout ones instead of stacking on them
    expect(backdrop.classes()).not.toContain("player-select-mobile-offset");
    const sheet = wrapper.find('[data-testid="player-select-sheet"]');
    expect(sheet.classes()).toContain("player-select-popover-fullscreen");
    expect(sheet.attributes("align")).toBe("center");
    expect(wrapper.findComponent(PopoverAnchorStub).props("reference")).toBe(
      fullscreenPlayerSelectAnchor,
    );
  });

  // reka reports the opening focus on the wrapper it positions the panel with,
  // and that wrapper cannot hold focus, so only a real mount shows where focus
  // ends up. A touchscreen is the gate either way: a phone held sideways gets
  // the desktop layout and still raises a keyboard.
  it.each([true, false])(
    "focuses the panel instead of the search field on touch (mobile layout: %s)",
    async (mobileLayout) => {
      store.isTouchscreen = true;
      store.mobileLayout = mobileLayout;
      api.players = manyPlayers();
      const wrapper = mountPlayerSelectWithPopover();

      const panel = await findOpenPanel();
      expect(document.activeElement).toBe(panel);

      wrapper.unmount();
    },
  );

  it("leaves the opening focus alone without a touchscreen", async () => {
    store.mobileLayout = true;
    api.players = manyPlayers();
    const wrapper = mountPlayerSelectWithPopover();

    const panel = await findOpenPanel();
    expect(document.activeElement).not.toBe(panel);
    expect(panel.contains(document.activeElement)).toBe(true);

    wrapper.unmount();
  });

  it("restores focus to the menu trigger after closing", async () => {
    store.showPlayersMenu = false;
    const wrapper = mountPlayerSelect();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    trigger.focus();

    store.showPlayersMenu = true;
    await nextTick();
    await wrapper.find(".player-select-backdrop").trigger("click");
    await nextTick();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("uses a stable focus fallback when the trigger was removed", async () => {
    store.showPlayersMenu = false;
    const wrapper = mountPlayerSelect();
    const trigger = document.createElement("button");
    const fallback = document.createElement("button");
    fallback.id = "player-select-button";
    document.body.append(trigger, fallback);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    trigger.focus();

    store.showPlayersMenu = true;
    await nextTick();
    trigger.remove();
    await wrapper.find(".player-select-backdrop").trigger("click");
    await nextTick();

    expect(document.activeElement).toBe(fallback);
    fallback.remove();
  });

  it("does not restore focus after pointer interaction", async () => {
    store.showPlayersMenu = false;
    const wrapper = mountPlayerSelect();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    trigger.focus();

    store.showPlayersMenu = true;
    await nextTick();
    await wrapper.find(".player-select-backdrop").trigger("click");
    await nextTick();

    expect(document.activeElement).not.toBe(trigger);
    trigger.remove();
  });

  it("handles Escape inside the sheet without reaching the page", async () => {
    const player = createPlayer("kitchen", "Kitchen");
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();

    await wrapper
      .find('[data-testid="player-select-sheet"]')
      .trigger("keydown", { key: "Escape" });

    expect(store.showPlayersMenu).toBe(false);
  });

  it("stays open while the context menu is active", () => {
    const player = createPlayer("kitchen", "Kitchen");
    api.players = { [player.player_id]: player };
    store.dialogActive = true;
    const wrapper = mountPlayerSelect();
    const event = new Event("pointerdown", { cancelable: true });

    wrapper
      .findComponent(PopoverContentStub)
      .vm.$emit("interact-outside", event);

    expect(event.defaultPrevented).toBe(true);
    expect(store.showPlayersMenu).toBe(true);
  });

  it("lets the player button close the open popover", () => {
    const player = createPlayer("kitchen", "Kitchen");
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();
    const trigger = document.createElement("button");
    trigger.id = "player-select-button";
    document.body.appendChild(trigger);
    const originalEvent = new Event("pointerdown");
    trigger.dispatchEvent(originalEvent);
    const event = new CustomEvent("interact-outside", {
      cancelable: true,
      detail: { originalEvent },
    });

    wrapper
      .findComponent(PopoverContentStub)
      .vm.$emit("interact-outside", event);

    expect(event.defaultPrevented).toBe(true);
    trigger.remove();
  });

  it("keeps inline grouping and child-volume controls mutually exclusive", async () => {
    const player = createPlayer("group", "Everywhere", PlaybackState.PLAYING);
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();
    const card = () => wrapper.find(".player-card");

    expect(card().attributes("data-child-volumes")).toBe("false");
    expect(card().attributes("data-member-controls")).toBe("false");

    await wrapper.find(".member-toggle").trigger("click");
    expect(card().attributes("data-member-controls")).toBe("true");
    expect(card().attributes("data-group-control-expanded")).toBe("true");
    expect(card().attributes("data-child-volumes")).toBe("false");

    await wrapper.find(".volume-toggle").trigger("click");
    expect(card().attributes("data-member-controls")).toBe("false");
    expect(card().attributes("data-group-control-expanded")).toBe("false");
    expect(card().attributes("data-child-volumes")).toBe("true");
  });

  it("allows inline grouping controls without showing an idle volume slider", async () => {
    const player = createPlayer("group", "Everywhere");
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();

    await wrapper.find(".member-toggle").trigger("click");

    expect(wrapper.find(".player-card").attributes("data-volume-control")).toBe(
      "false",
    );
    expect(
      wrapper.find(".player-card").attributes("data-member-controls"),
    ).toBe("true");
  });

  it("scrolls the selected player into view when it is not pinned", async () => {
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollIntoView",
    );
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    setPlayerSelectPreference("playerSelect.showSelectedPlayerFirst", false);
    setPlayerSelectPreference("playerSelect.showActivePlayersFirst", false);
    const selectedPlayer = createPlayer("selected", "Zulu");
    api.players = {
      attic: createPlayer("attic", "Attic"),
      selected: selectedPlayer,
    };
    store.activePlayerId = selectedPlayer.player_id;
    store.showPlayersMenu = false;

    const wrapper = mountPlayerSelect();
    store.showPlayersMenu = true;
    await nextTick();
    await nextTick();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(
      (scrollIntoView.mock.instances[0] as HTMLElement).dataset.playerId,
    ).toBe("selected");

    if (originalScrollIntoView) {
      Object.defineProperty(
        HTMLElement.prototype,
        "scrollIntoView",
        originalScrollIntoView,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });
});
