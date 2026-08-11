import PlayerSelect from "@/layouts/default/PlayerSelect.vue";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { api } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const {
  emitEvent,
  getPreference,
  isAdmin,
  preferenceState,
  savePlayerConfig,
  setPreference,
  storage,
} = vi.hoisted(() => {
  const values = new Map<string, string>();
  const storage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  vi.stubGlobal("localStorage", storage);
  return {
    emitEvent: vi.fn(),
    getPreference: vi.fn(),
    isAdmin: vi.fn(() => true),
    preferenceState: {
      values: {} as Record<string, unknown>,
      reactiveValues: undefined as Record<string, unknown> | undefined,
    },
    savePlayerConfig: vi.fn(),
    setPreference: vi.fn(),
    storage,
  };
});

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    savePlayerConfig,
  });
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined as Player | undefined,
      activePlayerId: undefined as string | undefined,
      companionPlayerId: undefined as string | undefined,
      dialogActive: false,
      mobileLayout: false,
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
    "playerMenuItems",
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
const PopoverContentStub = {
  name: "PopoverContent",
  emits: ["interact-outside", "open-auto-focus"],
  template: `
    <div
      tabindex="-1"
      @open-auto-focus="$emit('open-auto-focus', $event)"
    >
      <slot />
    </div>
  `,
};
const PlayerRenameDialogStub = {
  props: ["open", "player"],
  emits: ["update:open"],
  template: `
    <div
      v-if="open"
      class="player-rename-dialog"
      :data-player-id="player?.player_id"
    />
  `,
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

function setPlayerSelectPreference(key: string, value: boolean) {
  if (!preferenceState.reactiveValues) {
    throw new Error("Preference mock is not initialized");
  }
  preferenceState.reactiveValues[key] = value;
}

function mountPlayerSelect() {
  return mount(PlayerSelect, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        PlayerCard: PlayerCardStub,
        PlayerRenameDialog: PlayerRenameDialogStub,
        SearchInput: SearchInputStub,
        DropdownMenu: passthroughStub,
        DropdownMenuCheckboxItem: DropdownMenuCheckboxItemStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuItem: passthroughStub,
        DropdownMenuLabel: passthroughStub,
        DropdownMenuSeparator: passthroughStub,
        DropdownMenuTrigger: passthroughStub,
        Popover: passthroughStub,
        PopoverAnchor: passthroughStub,
        PopoverContent: PopoverContentStub,
        Teleport: true,
      },
    },
  });
}

describe("PlayerSelect", () => {
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const preferenceValues = preferenceState.reactiveValues;
    if (preferenceValues) {
      for (const key of Object.keys(preferenceValues)) {
        delete preferenceValues[key];
      }
    }
    api.players = {};
    savePlayerConfig.mockResolvedValue({});
    store.activePlayer = undefined;
    store.activePlayerId = undefined;
    store.companionPlayerId = undefined;
    store.dialogActive = false;
    store.mobileLayout = false;
    store.showPlayersMenu = true;
    webPlayer.player_id = null;
    storage.clear();
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
    store.activePlayer = activePlayer;
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
    store.activePlayer = selectedPlayer;
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
    storage.setItem("activePlayerId", remembered.player_id);
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
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();

    await wrapper.find(".select-player").trigger("click");

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

  it("stops above the bottom navigation in mobile layout", () => {
    store.mobileLayout = true;

    const wrapper = mountPlayerSelect();

    expect(wrapper.find(".player-select-backdrop").classes()).toContain(
      "player-select-mobile-offset",
    );
    expect(
      wrapper.find('[data-testid="player-select-sheet"]').classes(),
    ).toContain("player-select-popover");
  });

  it("focuses the sheet instead of opening the mobile keyboard", () => {
    store.mobileLayout = true;
    api.players = Object.fromEntries(
      Array.from({ length: 11 }, (_, index) => {
        const player = createPlayer(`player-${index}`, `Player ${index}`);
        return [player.player_id, player];
      }),
    );
    const wrapper = mountPlayerSelect();
    const popover = wrapper.get('[data-testid="player-select-sheet"]');
    if (!(popover.element instanceof HTMLElement)) {
      throw new TypeError("Expected popover to render as an HTML element");
    }
    const focus = vi.spyOn(popover.element, "focus");
    const event = new Event("open-auto-focus", { cancelable: true });

    popover.element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("keeps the default focus behavior in desktop layout", () => {
    const wrapper = mountPlayerSelect();
    const popover = wrapper.get('[data-testid="player-select-sheet"]');
    const event = new Event("open-auto-focus", { cancelable: true });

    popover.element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
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
    store.activePlayer = selectedPlayer;
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

  it("adds rename and disable actions only to PlayerSelect menus", async () => {
    const player = createPlayer("kitchen", "Kitchen");
    const fallback = createPlayer("office", "Office");
    const setupPlayer = createPlayer("attic", "Attic");
    setupPlayer.available = false;
    setupPlayer.needs_setup = true;
    api.players = {
      [player.player_id]: player,
      [fallback.player_id]: fallback,
      [setupPlayer.player_id]: setupPlayer,
    };
    store.activePlayer = player;
    store.activePlayerId = player.player_id;
    const wrapper = mountPlayerSelect();
    const menuItems = wrapper
      .getComponent(PlayerCardStub)
      .props("playerMenuItems") as ContextMenuItem[];

    expect(menuItems.map((item) => item.label)).toEqual([
      "player_select.rename_player",
      "player_select.disable_player",
    ]);

    menuItems[0].action?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.showPlayersMenu).toBe(false);
    expect(
      wrapper.get(".player-rename-dialog").attributes("data-player-id"),
    ).toBe(player.player_id);

    store.showPlayersMenu = true;
    await nextTick();
    menuItems[1].action?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const confirmation = emitEvent.mock.calls.find(
      ([event]) => event === "deleteConfirmationDialog",
    )?.[1];
    expect(confirmation).toEqual(
      expect.objectContaining({
        confirmLabel: "settings.disable",
      }),
    );

    await confirmation.onConfirm();
    await flushPromises();
    expect(savePlayerConfig).toHaveBeenCalledWith(player.player_id, {
      enabled: false,
    });
    expect(player.enabled).toBe(false);
    expect(store.activePlayerId).toBe(fallback.player_id);
  });
});
