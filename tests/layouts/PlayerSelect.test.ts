import PlayerSelect from "@/layouts/default/PlayerSelect.vue";
import { api } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getPreference, setPreference, storage } = vi.hoisted(() => {
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
    getPreference: vi.fn(() => ({ value: undefined })),
    setPreference: vi.fn(),
    storage,
  };
});

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
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
      showPlayersMenu: true,
    }),
  };
});

vi.mock("@/plugins/web_player", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    webPlayer: reactive({
      player_id: undefined as string | undefined,
    }),
  };
});

vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({
    getPreference,
    setPreference,
  }),
}));

vi.mock("@/helpers/utils", () => ({
  isBuiltinPlayer: (player: Player) => player.player_id === "builtin",
  playerVisible: () => true,
}));

const PlayerCardStub = {
  props: [
    "player",
    "showChildVolumes",
    "showMemberControls",
    "showGroupControls",
  ],
  emits: ["click", "toggle-child-volumes", "toggle-member-controls"],
  template: `
    <article
      class="player-card"
      :data-player-id="player.player_id"
      :data-child-volumes="showChildVolumes ? 'true' : 'false'"
      :data-member-controls="showMemberControls ? 'true' : 'false'"
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
        @click="$emit('toggle-member-controls', player)"
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
    output_protocols: [],
    active_output_protocol: null,
  };
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
        Sheet: passthroughStub,
        SheetContent: passthroughStub,
        SheetDescription: passthroughStub,
        SheetHeader: passthroughStub,
        SheetTitle: passthroughStub,
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
    api.players = {};
    store.activePlayer = undefined;
    store.activePlayerId = undefined;
    store.companionPlayerId = undefined;
    store.showPlayersMenu = true;
    webPlayer.player_id = null;
    storage.clear();
  });

  it("orders the active player first, then playing players", () => {
    const activePlayer = createPlayer("active", "Kitchen");
    api.players = {
      office: createPlayer("office", "Office"),
      bedroom: createPlayer("bedroom", "Bedroom", PlaybackState.PLAYING),
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

  it("closes from the blurred backdrop", async () => {
    const player = createPlayer("kitchen", "Kitchen");
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();

    await wrapper.find(".player-select-backdrop").trigger("click");

    expect(store.showPlayersMenu).toBe(false);
  });

  it("restores focus to the menu trigger after closing", async () => {
    store.showPlayersMenu = false;
    const wrapper = mountPlayerSelect();
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
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
    fallback.id = "active-player-popover";
    document.body.append(trigger, fallback);
    trigger.focus();

    store.showPlayersMenu = true;
    await nextTick();
    trigger.remove();
    await wrapper.find(".player-select-backdrop").trigger("click");
    await nextTick();

    expect(document.activeElement).toBe(fallback);
    fallback.remove();
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

  it("keeps member and child-volume controls mutually exclusive", async () => {
    const player = createPlayer("group", "Everywhere");
    api.players = { [player.player_id]: player };
    const wrapper = mountPlayerSelect();
    const card = () => wrapper.find(".player-card");

    expect(card().attributes("data-child-volumes")).toBe("false");
    expect(card().attributes("data-member-controls")).toBe("false");

    await wrapper.find(".member-toggle").trigger("click");
    expect(card().attributes("data-member-controls")).toBe("true");
    expect(card().attributes("data-child-volumes")).toBe("false");

    await wrapper.find(".volume-toggle").trigger("click");
    expect(card().attributes("data-member-controls")).toBe("false");
    expect(card().attributes("data-child-volumes")).toBe("true");
  });
});
