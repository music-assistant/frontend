import PlayerCard from "@/components/PlayerCard.vue";
import {
  IdentifierType,
  MediaType,
  PlaybackState,
  type Player,
  PlayerFeature,
  type PlayerMedia,
  PlayerType,
  type Scope,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { store } from "@/plugins/store";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, emitContextMenu, hasScope } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, Player>,
    queues: {} as Record<
      string,
      {
        active?: boolean;
        extra_attributes?: {
          play_action_in_progress?: boolean;
        };
        items?: number;
      }
    >,
    playerCommandPlayPause:
      vi.fn<MusicAssistantApi["playerCommandPlayPause"]>(),
    playerCommandPowerToggle:
      vi.fn<MusicAssistantApi["playerCommandPowerToggle"]>(),
  },
  emitContextMenu: vi.fn(),
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope },
}));

vi.mock("@/plugins/store", () => ({
  store: {
    activePlayerId: "active",
    deviceType: "desktop",
  },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    emit: emitContextMenu,
  },
}));

vi.mock("@/composables/activeSource", () => ({
  useActiveSource: () => ({
    activeSource: {
      value: {
        can_play_pause: true,
      },
    },
  }),
}));

vi.mock("@/composables/useHoldToOpenMenu", () => ({
  getEventPosition: () => ({ x: 1, y: 2 }),
  useHoldToOpenMenu: () => ({
    onHold: vi.fn(),
    onTouchStart: vi.fn(),
    swallowClickAfterHold: vi.fn(),
  }),
}));

vi.mock("@/helpers/player_menu_items", () => ({
  getPlayerMenuItems: () => [],
}));

vi.mock("@/helpers/player_settings_actions", () => ({
  getSetupRequiredPlayerMenuItems: () => [{ label: "configure_player" }],
}));

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
}));

vi.mock("@/helpers/players", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/helpers/players")>();
  const getPlayerDisplayName = (player: Player) =>
    player.player_id === "builtin" ? "this_device" : player.name;
  return {
    ...actual,
    isBuiltinPlayer: (player: Player) => player.player_id === "builtin",
    getPlayerDisplayName,
    getPlayerName: (player: Player) => {
      const childCount = player.group_members.filter(
        (playerId) =>
          playerId !== player.player_id && apiMock.players[playerId]?.available,
      ).length;
      return player.type !== PlayerType.GROUP && childCount > 0
        ? `${getPlayerDisplayName(player)} +${childCount}`
        : getPlayerDisplayName(player);
    },
  };
});

const ButtonStub = {
  template: "<button><slot /></button>",
};

const CardStub = {
  template: "<div><slot /></div>",
};

const BadgeStub = {
  template: "<span><slot /></span>",
};

const VolumeControlStub = {
  props: ["showMemberControls", "showVolumeControl"],
  emits: ["toggle-child-volumes"],
  template: `
    <button
      class="volume-control"
      :data-member-controls="showMemberControls ? 'true' : 'false'"
      :data-volume-control="showVolumeControl ? 'true' : 'false'"
      @click="$emit('toggle-child-volumes')"
    />
  `,
};

// the server sends every PlayerMedia key, using null for the ones it has no value for
function createPlayerMedia(overrides: Partial<PlayerMedia> = {}): PlayerMedia {
  return {
    uri: "test://track",
    media_type: MediaType.TRACK,
    title: null,
    artist: null,
    album: null,
    image_url: null,
    palette: null,
    duration: null,
    source_id: null,
    elapsed_time: null,
    elapsed_time_last_updated: null,
    queue_item_id: null,
    ...overrides,
  };
}

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "player",
    provider: "test",
    type: PlayerType.PLAYER,
    name: "Kitchen",
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
    supported_features: [PlayerFeature.SET_MEMBERS],
    can_group_with: ["child"],
    enabled: true,
    playback_state: PlaybackState.IDLE,
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
    setup_reason: null,
    legacy_ids: [],
    protocols: [],
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
    sleep_timer_mode: null,
    active_source_audio: null,
    ...overrides,
  };
}

function mountPlayerCard(
  player: Player,
  props: {
    groupControlExpanded?: boolean;
    groupControlsId?: string;
    showDisabledGroupControl?: boolean;
    showMemberControls?: boolean;
    showSelectedIndicator?: boolean;
    showGroupMemberNames?: boolean;
    showVolumeControl?: boolean;
    stackMediaDetails?: boolean;
  } = {},
) {
  return mount(PlayerCard, {
    props: {
      player,
      allowPowerControl: true,
      showGroupControls: true,
      showMenuButton: true,
      showVolumeControl: true,
      ...props,
    },
    global: {
      directives: {
        hold: () => undefined,
      },
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        Badge: BadgeStub,
        Button: ButtonStub,
        Card: CardStub,
        PlayerIcon: {
          template: '<span class="player-icon" />',
        },
        Spinner: {
          template: '<span class="spinner" />',
        },
        VolumeControl: VolumeControlStub,
      },
    },
  });
}

describe("PlayerCard", () => {
  beforeEach(() => {
    apiMock.players = {};
    apiMock.queues = {};
    store.deviceType = "desktop";
    hasScope.mockReturnValue(true);
  });

  it("uses a primary border for the active player", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        player_id: "active",
      }),
    );

    expect(wrapper.classes()).toContain("border-primary");
  });

  it("labels the selected player when requested by the selector", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        player_id: "active",
        playback_state: PlaybackState.PLAYING,
      }),
      { showSelectedIndicator: true },
    );

    expect(wrapper.classes()).toContain("ring-1");
    expect(wrapper.classes()).not.toContain("pt-4");
    expect(wrapper.find(".selected-player-badge").exists()).toBe(false);
    const indicator = wrapper.get(".selected-player-indicator");
    expect(indicator.text()).toBe("player_tip.selected");
    expect(indicator.attributes("variant")).toBe("default");
    expect(
      wrapper.find(".player-card-name + .selected-player-indicator").exists(),
    ).toBe(true);
  });

  it("keeps the player details in the selection action name", () => {
    const wrapper = mountPlayerCard(createPlayer());
    const action = wrapper.find(".player-select-action");

    expect(action.attributes("aria-label")).toBeUndefined();
    expect(action.text()).toContain("tooltip.select_player");
    expect(action.text()).toContain("Kitchen");
  });

  it("includes queue status in the selection action name", () => {
    const player = createPlayer();
    apiMock.queues[player.player_id] = { active: true, items: 0 };

    const wrapper = mountPlayerCard(player);

    expect(wrapper.find(".player-select-action").text()).toContain(
      "queue_empty",
    );
  });

  it("keeps setup-required player details at full opacity", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        available: false,
        needs_setup: true,
        powered: false,
      }),
    );

    expect(wrapper.classes()).not.toContain("opacity-80");
    expect(wrapper.classes()).not.toContain("opacity-60");
    expect(wrapper.classes()).not.toContain("opacity-40");
    expect(wrapper.find(".player-card-name").text()).toBe("Kitchen");
    expect(wrapper.text()).toContain("settings.setup_required");
    expect(wrapper.find(".player-select-action").text()).toContain(
      "configure_player",
    );
    expect(wrapper.find(".player-select-action").text()).toContain(
      "settings.setup_required",
    );
    expect(wrapper.find(".player-select-action").text()).not.toContain(
      "tooltip.select_player",
    );
    expect(
      wrapper.find(".player-select-action").attributes("disabled"),
    ).toBeUndefined();
    expect(wrapper.find('[aria-label="play"]').attributes("disabled")).toBe("");
  });

  it("names why a player needs setup", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        available: false,
        needs_setup: true,
        setup_reason: "pairing_required",
      }),
    );

    expect(wrapper.text()).toContain("Pairing required");
    expect(wrapper.text()).not.toContain("settings.setup_required");
  });

  it("offers the setup menu for a player that needs setup", async () => {
    vi.clearAllMocks();
    const wrapper = mountPlayerCard(
      createPlayer({ available: false, needs_setup: true }),
    );
    const menuButton = wrapper.find('[aria-label="tooltip.more_options"]');

    expect(menuButton.attributes("disabled")).toBeUndefined();
    await menuButton.trigger("click");

    expect(emitContextMenu).toHaveBeenCalledWith(
      "contextmenu",
      expect.objectContaining({ items: [{ label: "configure_player" }] }),
    );
  });

  it("keeps the menu of a player that needs setup from a role that may not set it up", async () => {
    vi.clearAllMocks();
    hasScope.mockReturnValue(false);
    const wrapper = mountPlayerCard(
      createPlayer({ available: false, needs_setup: true }),
    );
    const menuButton = wrapper.find('[aria-label="tooltip.more_options"]');

    expect(menuButton.attributes("disabled")).toBeDefined();
    await wrapper.trigger("contextmenu");

    expect(emitContextMenu).not.toHaveBeenCalled();
  });

  it("names the synced players on one line under the plus count", () => {
    const playerB = createPlayer({ player_id: "player-b", name: "Player B" });
    const playerC = createPlayer({ player_id: "player-c", name: "Player C" });
    const offline = createPlayer({
      player_id: "offline",
      name: "Player D",
      available: false,
    });
    const parent = createPlayer({
      name: "Player A",
      group_members: ["player-b", "player", "player-c", "offline"],
      current_media: createPlayerMedia({ title: "Song", artist: "Artist" }),
    });
    apiMock.players = {
      [parent.player_id]: parent,
      [playerB.player_id]: playerB,
      [playerC.player_id]: playerC,
      [offline.player_id]: offline,
    };

    const wrapper = mountPlayerCard(parent, {
      showGroupMemberNames: true,
      stackMediaDetails: true,
    });
    const members = wrapper.get(".player-card-group-members");

    expect(wrapper.get(".player-card-name").text()).toBe("Player A +2");
    expect(members.text()).toBe("Player B • Player C");
    expect(members.classes()).toEqual(
      expect.arrayContaining(["truncate", "text-xs", "text-muted-foreground"]),
    );
    expect(wrapper.get(".player-select-action").text()).toContain(
      "Player A. Player B. Player C. Song. Artist",
    );
  });

  it("keeps the plus count in the name without the member line", () => {
    const playerB = createPlayer({ player_id: "player-b", name: "Player B" });
    const parent = createPlayer({
      name: "Player A",
      group_members: ["player", "player-b"],
    });
    apiMock.players = {
      [parent.player_id]: parent,
      [playerB.player_id]: playerB,
    };

    const wrapper = mountPlayerCard(parent, { stackMediaDetails: true });

    expect(wrapper.get(".player-card-name").text()).toBe("Player A +1");
    expect(wrapper.find(".player-card-group-members").exists()).toBe(false);
  });

  it("names a built-in group member after this device", () => {
    const builtin = createPlayer({
      player_id: "builtin",
      name: "Web player (Chrome)",
    });
    const parent = createPlayer({
      name: "Player A",
      group_members: ["player", "builtin"],
    });
    apiMock.players = {
      [parent.player_id]: parent,
      [builtin.player_id]: builtin,
    };

    const wrapper = mountPlayerCard(parent, { showGroupMemberNames: true });

    expect(wrapper.find(".player-card-name").text()).toBe("Player A +1");
    expect(wrapper.find(".player-card-group-members").text()).toBe(
      "this_device",
    );
  });

  it("names the built-in player after this device, with an icon-only badge", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        player_id: "builtin",
        name: "Marcel's Mac (Chrome)",
      }),
    );
    const badge = wrapper.get(".player-device-badge");

    expect(wrapper.get(".player-card-name").text()).toBe("this_device");
    expect(wrapper.text()).not.toContain("Marcel's Mac (Chrome)");
    expect(badge.attributes("aria-hidden")).toBe("true");
    expect(badge.find(".player-device-badge-label").exists()).toBe(false);
  });

  it.each([
    ["desktop", "lucide-monitor"],
    ["phone", "lucide-smartphone"],
    ["tablet", "lucide-tablet"],
  ] as const)("shows the %s form factor on the badge", (deviceType, icon) => {
    store.deviceType = deviceType;

    const wrapper = mountPlayerCard(
      createPlayer({
        player_id: "builtin",
      }),
    );

    expect(wrapper.get(".player-device-badge").find(`.${icon}`).exists()).toBe(
      true,
    );
  });

  it("uses a neutral outline for the this-device badge", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        player_id: "builtin",
      }),
    );
    const badge = wrapper.get(".player-device-badge");

    expect(badge.classes()).toContain("border-foreground/25");
    expect(badge.classes()).toContain("text-muted-foreground");
    expect(badge.classes()).toContain("shadow-none");
  });

  it("lists every member of a group player on one line", () => {
    const playerB = createPlayer({ player_id: "player-b", name: "Player B" });
    const playerC = createPlayer({
      player_id: "player-c",
      name: "Player C",
      available: false,
    });
    const group = createPlayer({
      player_id: "group-a",
      name: "Group A",
      type: PlayerType.GROUP,
      group_members: [playerB.player_id, playerC.player_id, playerB.player_id],
    });
    apiMock.players = {
      [group.player_id]: group,
      [playerB.player_id]: playerB,
      [playerC.player_id]: playerC,
    };

    const wrapper = mountPlayerCard(group, {
      showGroupMemberNames: true,
      stackMediaDetails: true,
    });
    const members = wrapper.get(".player-card-group-members");

    expect(wrapper.get(".player-card-name").text()).toBe("Group A");
    expect(members.text()).toBe("Player B • Player C");
    expect(members.classes()).toEqual(
      expect.arrayContaining(["truncate", "text-xs"]),
    );
  });

  it("keeps panel cards to one row with a single media line", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        playback_state: PlaybackState.PLAYING,
        current_media: createPlayerMedia({
          title: "Hate Me Now",
          artist: "Nas",
          album: "I Am...",
          image_url: "https://example.test/cover.jpg",
        }),
      }),
      { stackMediaDetails: true },
    );

    expect(wrapper.find(".player-card-main").classes()).not.toContain(
      "flex-col",
    );
    const summary = wrapper.get(".player-card-media-summary");
    expect(summary.text()).toBe("Hate Me Now • Nas • I Am...");
    expect(summary.element.tagName).toBe("DIV");
    expect(summary.get("span").classes()).toContain("truncate");
    expect(wrapper.find(".player-card-actions").classes()).not.toContain(
      "self-end",
    );
  });

  it.each([
    ["idle", createPlayer()],
    ["powered off", createPlayer({ powered: false })],
    [
      "powered off with media",
      createPlayer({
        powered: false,
        current_media: createPlayerMedia({ title: "Hate Me Now" }),
      }),
    ],
  ])("leaves the media line out of %s panel cards", (_state, player) => {
    const wrapper = mountPlayerCard(player, { stackMediaDetails: true });

    expect(wrapper.find(".player-card-media-summary").exists()).toBe(false);
    expect(wrapper.find(".player-card-main").classes()).toContain(
      "items-center",
    );
  });

  it.each([
    ["idle", createPlayer()],
    [
      "playing with artwork",
      createPlayer({
        playback_state: PlaybackState.PLAYING,
        current_media: createPlayerMedia({
          title: "Hate Me Now",
          artist: "Nas",
          image_url: "https://example.test/cover.jpg",
        }),
      }),
    ],
    [
      "paused with artwork",
      createPlayer({
        playback_state: PlaybackState.PAUSED,
        current_media: createPlayerMedia({
          title: "Hate Me Now",
          image_url: "https://example.test/cover.jpg",
        }),
      }),
    ],
    [
      "powered off",
      createPlayer({
        powered: false,
        current_media: createPlayerMedia({
          image_url: "https://example.test/cover.jpg",
        }),
      }),
    ],
    ["needing setup", createPlayer({ available: false, needs_setup: true })],
    ["an audio input", createPlayer({ type: PlayerType.SOURCE })],
  ])(
    "shows the player icon tile before the name in panel cards when %s",
    (_state, player) => {
      const wrapper = mountPlayerCard(player, { stackMediaDetails: true });
      const [tile, details] = wrapper.get(".player-card-main").element.children;

      expect(tile.querySelector(".player-icon")).not.toBeNull();
      expect(tile.classList).toContain("size-11");
      expect(details.firstElementChild?.classList).toContain(
        "player-card-title",
      );
      expect(wrapper.findAll(".player-icon")).toHaveLength(1);
      expect(wrapper.find("img").exists()).toBe(false);
      expect(wrapper.get(".player-card-name").text()).toBe("Kitchen");
    },
  );

  it("leads the media line of a playing panel card with the equalizer", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        playback_state: PlaybackState.PLAYING,
        current_media: createPlayerMedia({ title: "Song" }),
      }),
      { stackMediaDetails: true },
    );
    const summary = wrapper.get(".player-card-media-summary");
    const indicator = summary.get(".player-playing-indicator");

    expect(summary.element.firstElementChild).toBe(indicator.element);
    expect(indicator.attributes("role")).toBe("img");
    expect(indicator.attributes("aria-label")).toBe("state.playing");
    expect(indicator.find(".now-playing-icon").exists()).toBe(true);
    expect(summary.classes()).toContain("text-foreground");
    expect(summary.classes()).not.toContain("text-muted-foreground");
    expect(
      wrapper.find(".player-card-title .player-playing-indicator").exists(),
    ).toBe(false);
  });

  it.each([PlaybackState.PAUSED, PlaybackState.IDLE])(
    "greys out the media line of a panel card that is %s",
    (playbackState) => {
      const wrapper = mountPlayerCard(
        createPlayer({
          playback_state: playbackState,
          current_media: createPlayerMedia({ title: "Song" }),
        }),
        { stackMediaDetails: true },
      );
      const summary = wrapper.get(".player-card-media-summary");

      expect(summary.text()).toBe("Song");
      expect(summary.find(".player-playing-indicator").exists()).toBe(false);
      expect(summary.classes()).toContain("text-muted-foreground");
    },
  );

  it("shows the equalizer on its own while playing without media", () => {
    const wrapper = mountPlayerCard(
      createPlayer({ playback_state: PlaybackState.PLAYING }),
      { stackMediaDetails: true },
    );
    const summary = wrapper.get(".player-card-media-summary");

    expect(summary.text()).toBe("");
    expect(summary.find(".player-playing-indicator").exists()).toBe(true);
    expect(summary.find("span").exists()).toBe(false);
  });

  it("shows neither equalizer nor media line for a powered-off player", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        powered: false,
        playback_state: PlaybackState.PLAYING,
        current_media: createPlayerMedia({ title: "Song" }),
      }),
      { stackMediaDetails: true },
    );

    expect(wrapper.find(".player-card-media-summary").exists()).toBe(false);
    expect(wrapper.find(".player-playing-indicator").exists()).toBe(false);
  });

  it.each([
    [PlaybackState.PLAYING, true],
    [PlaybackState.PAUSED, false],
  ])(
    "leads the media title of an unstacked card with the equalizer only while playing (%s)",
    (playbackState, hasIndicator) => {
      const wrapper = mountPlayerCard(
        createPlayer({
          playback_state: playbackState,
          current_media: createPlayerMedia({ title: "Song", artist: "Artist" }),
        }),
      );
      const title = wrapper.get(".player-card-media-summary");

      expect(title.text()).toBe("Song");
      expect(title.classes()).toContain("font-medium");
      expect(title.find(".player-playing-indicator").exists()).toBe(
        hasIndicator,
      );
      expect(wrapper.get(".player-card-media-summary + p").text()).toBe(
        "Artist",
      );
    },
  );

  it.each([PlaybackState.PLAYING, PlaybackState.PAUSED])(
    "shows artwork while %s",
    (playbackState) => {
      const wrapper = mountPlayerCard(
        createPlayer({
          playback_state: playbackState,
          current_media: createPlayerMedia({
            image_url: "https://example.test/cover.jpg",
          }),
        }),
      );

      expect(wrapper.find("img").attributes("src")).toBe(
        "https://example.test/cover.jpg",
      );
    },
  );

  it("shows the player icon instead of idle artwork", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        current_media: createPlayerMedia({
          image_url: "https://example.test/cover.jpg",
        }),
      }),
    );

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find(".player-icon").exists()).toBe(true);
  });

  it("labels the pause control with its action", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        playback_state: PlaybackState.PLAYING,
      }),
    );

    expect(wrapper.find('[aria-label="pause"]').exists()).toBe(true);
  });

  it("keeps card controls separate from player selection", async () => {
    vi.clearAllMocks();
    const player = createPlayer({
      powered: false,
      group_members: ["player", "child"],
    });

    const wrapper = mountPlayerCard(player);

    await wrapper.find(".player-select-action").trigger("click");
    expect(wrapper.emitted("click")).toEqual([[player]]);

    await wrapper.find('[aria-label="tooltip.toggle_power"]').trigger("click");
    await wrapper
      .find('[aria-label="tooltip.group_members: 2"]')
      .trigger("click");
    await wrapper.find('[aria-label="play"]').trigger("click");
    await wrapper.find('[aria-label="tooltip.more_options"]').trigger("click");
    await wrapper.find(".volume-control").trigger("click");

    expect(wrapper.emitted("click")).toHaveLength(1);
    expect(apiMock.playerCommandPowerToggle).toHaveBeenCalledWith(
      player.player_id,
    );
    expect(apiMock.playerCommandPlayPause).toHaveBeenCalledWith(
      player.player_id,
    );
    const memberControlEvent = wrapper.emitted("toggle-member-controls");
    expect(memberControlEvent).toHaveLength(1);
    expect(memberControlEvent?.[0][0]).toEqual(player);
    expect(memberControlEvent?.[0][1]).toBeInstanceOf(HTMLElement);
    expect(wrapper.emitted("toggle-child-volumes")).toEqual([[player]]);
    expect(emitContextMenu).toHaveBeenCalledWith(
      "contextmenu",
      expect.objectContaining({
        posX: 1,
        posY: 2,
      }),
    );
  });

  it("exposes the group panel state from the group-count control", async () => {
    const player = createPlayer({
      group_members: ["player", "child"],
    });
    const wrapper = mountPlayerCard(player, {
      groupControlExpanded: true,
      groupControlsId: "group-panel",
    });
    const control = wrapper.get("[data-player-group-control]");

    expect(control.text()).toContain("2");
    expect(control.attributes("aria-controls")).toBe("group-panel");
    expect(control.attributes("aria-expanded")).toBe("true");
    await control.trigger("click");
    expect(wrapper.emitted("toggle-member-controls")?.[0][0]).toEqual(player);
  });

  it("renders inline grouping without an inactive volume slider", () => {
    const wrapper = mountPlayerCard(createPlayer(), {
      groupControlsId: "group-panel",
      showMemberControls: true,
      showVolumeControl: false,
    });
    const controls = wrapper.get(".volume-control");

    expect(controls.attributes("id")).toBe("group-panel");
    expect(controls.attributes("data-member-controls")).toBe("true");
    expect(controls.attributes("data-volume-control")).toBe("false");
  });

  it("reserves a neutral disabled grouping slot beside the menu", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        supported_features: [],
        can_group_with: [],
      }),
      { showDisabledGroupControl: true },
    );
    const actions = wrapper
      .find(".player-card-actions")
      .findAll("button")
      .map((button) => button.attributes("aria-label"));
    const groupControl = wrapper.get("[data-player-group-control]");
    const count = wrapper.get("[data-player-group-count]");

    expect(actions).toEqual([
      "play",
      "tooltip.group_members: 1",
      "tooltip.more_options",
    ]);
    expect(groupControl.attributes("disabled")).toBeDefined();
    // the badge takes the speaker's own colour rather than an accent, so a
    // disabled slot stays as quiet as the icon it sits on
    expect(count.classes()).toContain("bg-muted-foreground/90");
    expect(count.get("span").classes()).toContain("text-background");
    expect(count.classes()).not.toContain("bg-primary");
  });

  it("stops the native context-menu event at the card", () => {
    vi.clearAllMocks();
    const wrapper = mountPlayerCard(createPlayer());
    const parent = wrapper.element.parentElement;
    const parentHandler = vi.fn();
    parent?.addEventListener("contextmenu", parentHandler);
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });

    wrapper.element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(parentHandler).not.toHaveBeenCalled();
    expect(emitContextMenu).toHaveBeenCalledOnce();
  });

  it("disables every action for an unavailable player", async () => {
    vi.clearAllMocks();
    const player = createPlayer({
      available: false,
      powered: false,
      group_members: ["player", "child"],
    });
    const wrapper = mountPlayerCard(player);
    const actionSelectors = [
      '[aria-label="tooltip.toggle_power"]',
      '[aria-label="tooltip.group_members: 2"]',
      '[aria-label="play"]',
      '[aria-label="tooltip.more_options"]',
    ];

    for (const selector of actionSelectors) {
      const action = wrapper.find(selector);
      expect(action.attributes("disabled")).toBeDefined();
      await action.trigger("click");
    }

    expect(apiMock.playerCommandPowerToggle).not.toHaveBeenCalled();
    expect(apiMock.playerCommandPlayPause).not.toHaveBeenCalled();
    expect(wrapper.emitted("toggle-member-controls")).toBeUndefined();
    expect(emitContextMenu).not.toHaveBeenCalled();
  });
});
