import PlayerCard from "@/components/PlayerCard.vue";
import {
  IdentifierType,
  MediaType,
  PlaybackState,
  type Player,
  PlayerFeature,
  type PlayerMedia,
  PlayerType,
} from "@/plugins/api/interfaces";
import type { MusicAssistantApi } from "@/plugins/api";
import { store } from "@/plugins/store";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, emitContextMenu } = vi.hoisted(() => ({
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
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
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

vi.mock("@/helpers/utils", () => ({
  getMediaImageUrl: (url: string) => url,
  getPlayerName: (player: Player) => {
    const childCount = player.group_members.filter(
      (playerId) =>
        playerId !== player.player_id && apiMock.players[playerId]?.available,
    ).length;
    return player.type !== PlayerType.GROUP && childCount > 0
      ? `${player.name} +${childCount}`
      : player.name;
  },
}));

vi.mock("@/helpers/players", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/helpers/players")>();
  return {
    ...actual,
    isBuiltinPlayer: (player: Player) => player.player_id === "builtin",
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
    groupMemberLayout?: "subtitle" | "subtitle-list" | "title-list";
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
      }),
      { showSelectedIndicator: true },
    );

    expect(wrapper.classes()).toContain("ring-1");
    expect(wrapper.classes()).toContain("pt-4");
    const badge = wrapper.get(".selected-player-badge");
    expect(badge.text()).toBe("player_tip.selected_player");
    expect(badge.classes()).toContain("rounded-full");
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
    expect(
      wrapper
        .find('[aria-label="tooltip.more_options"]')
        .attributes("disabled"),
    ).toBe("");
  });

  it("lists every player name in a manual group", () => {
    const office = createPlayer({
      player_id: "office",
      name: "Office",
    });
    const patio = createPlayer({
      player_id: "patio",
      name: "Patio",
    });
    const offline = createPlayer({
      player_id: "offline",
      name: "Offline",
      available: false,
    });
    const parent = createPlayer({
      group_members: ["office", "player", "patio", "offline"],
    });
    apiMock.players = {
      [parent.player_id]: parent,
      [office.player_id]: office,
      [patio.player_id]: patio,
      [offline.player_id]: offline,
    };

    const mainCard = mountPlayerCard(parent);
    expect(mainCard.find(".player-card-name").text()).toBe("Kitchen +2");
    expect(mainCard.find(".player-card-group-members").exists()).toBe(false);
    mainCard.unmount();

    const wrapper = mountPlayerCard(parent, {
      showGroupMemberNames: true,
    });
    const members = wrapper.find(".player-card-group-members");

    expect(wrapper.find(".player-card-name").text()).toBe("Kitchen +2");
    expect(members.text()).toBe("Kitchen • Office • Patio");
    expect(members.classes()).toContain("text-[11px]");
    expect(
      wrapper
        .find(".player-select-action")
        .text()
        .match(/Kitchen/g),
    ).toHaveLength(1);
  });

  it("can render grouped players as separate title lines", () => {
    const office = createPlayer({
      player_id: "office",
      name: "Office",
    });
    const patio = createPlayer({
      player_id: "patio",
      name: "Patio",
    });
    const parent = createPlayer({
      group_members: ["office", "player", "patio"],
    });
    apiMock.players = {
      [parent.player_id]: parent,
      [office.player_id]: office,
      [patio.player_id]: patio,
    };

    const wrapper = mountPlayerCard(parent, {
      groupMemberLayout: "title-list",
      showGroupMemberNames: true,
    });

    expect(
      wrapper.findAll(".player-card-name").map((name) => name.text()),
    ).toEqual(["Kitchen", "Office", "Patio"]);
    expect(wrapper.find(".player-card-group-members").exists()).toBe(false);
  });

  it("can render each grouped child on a larger subtitle line", () => {
    const office = createPlayer({
      player_id: "office",
      name: "Office",
    });
    const patio = createPlayer({
      player_id: "patio",
      name: "Patio",
    });
    const parent = createPlayer({
      group_members: ["office", "player", "patio"],
    });
    apiMock.players = {
      [parent.player_id]: parent,
      [office.player_id]: office,
      [patio.player_id]: patio,
    };

    const wrapper = mountPlayerCard(parent, {
      groupMemberLayout: "subtitle-list",
      showGroupMemberNames: true,
    });

    expect(wrapper.find(".player-card-name").text()).toBe("Kitchen");
    expect(
      wrapper.findAll(".player-card-group-member").map((name) => name.text()),
    ).toEqual(["Office", "Patio"]);
    expect(wrapper.find(".player-card-group-member").classes()).toContain(
      "text-xs",
    );
  });

  it("expands grouped child names beyond the first two", async () => {
    const children = Array.from({ length: 5 }, (_, index) =>
      createPlayer({
        player_id: `child-${index}`,
        name: `Child ${index + 1}`,
      }),
    );
    const parent = createPlayer({
      group_members: ["player", ...children.map((child) => child.player_id)],
    });
    apiMock.players = {
      [parent.player_id]: parent,
      ...Object.fromEntries(children.map((child) => [child.player_id, child])),
    };
    const wrapper = mountPlayerCard(parent, {
      groupMemberLayout: "subtitle-list",
      showGroupMemberNames: true,
    });
    const visibleNames = () =>
      wrapper.findAll(".player-card-group-member").map((name) => name.text());
    const toggle = wrapper.get(".player-card-group-toggle");

    expect(visibleNames()).toEqual(["Child 1", "Child 2"]);
    expect(toggle.attributes("data-remaining-count")).toBe("3");

    await toggle.trigger("click");
    expect(visibleNames()).toEqual([
      "Child 1",
      "Child 2",
      "Child 3",
      "Child 4",
      "Child 5",
    ]);
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(wrapper.emitted("click")).toBeUndefined();

    await toggle.trigger("click");
    expect(visibleNames()).toEqual(["Child 1", "Child 2"]);
  });

  it("keeps the this-device badge accessible on phones", () => {
    store.deviceType = "phone";

    const wrapper = mountPlayerCard(
      createPlayer({
        player_id: "builtin",
      }),
    );
    const badgeLabel = wrapper.find(".player-device-badge-label");

    expect(badgeLabel.text()).toBe("this_device");
    expect(badgeLabel.classes()).toContain("sr-only");
  });

  it("uses a neutral outline for the this-device badge", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        player_id: "builtin",
      }),
    );
    const badge = wrapper.get(".player-device-badge-label").element
      .parentElement;

    expect(badge?.classList).toContain("border-foreground/25");
    expect(badge?.classList).toContain("text-muted-foreground");
    expect(badge?.classList).toContain("shadow-none");
  });

  it("shows member names beneath a dedicated group title", () => {
    const livingRoom = createPlayer({
      player_id: "living-room",
      name: "Living room",
    });
    const kitchen = createPlayer({
      player_id: "kitchen",
      name: "Kitchen",
    });
    const group = createPlayer({
      player_id: "downstairs",
      name: "Downstairs",
      type: PlayerType.GROUP,
      group_members: [livingRoom.player_id, kitchen.player_id],
    });
    apiMock.players = {
      [group.player_id]: group,
      [livingRoom.player_id]: livingRoom,
      [kitchen.player_id]: kitchen,
    };

    const wrapper = mountPlayerCard(group, {
      showGroupMemberNames: true,
    });
    const members = wrapper.find(".player-card-group-members");

    expect(wrapper.find(".player-card-name").text()).toBe("Downstairs");
    expect(members.text()).toBe("Living room • Kitchen");
    expect(members.classes()).toContain("text-[11px]");
  });

  it("stacks player identity above media only when requested", () => {
    const player = createPlayer({
      playback_state: PlaybackState.PLAYING,
      current_media: createPlayerMedia({
        title: "Hate Me Now",
        artist: "Nas",
      }),
    });

    const mainCard = mountPlayerCard(player);
    expect(mainCard.find(".player-card-main").classes()).not.toContain(
      "flex-col",
    );
    expect(mainCard.find(".player-card-actions").classes()).not.toContain(
      "self-end",
    );
    mainCard.unmount();

    const selectorCard = mountPlayerCard(player, {
      stackMediaDetails: true,
    });
    expect(selectorCard.find(".player-card-main").classes()).toContain(
      "flex-col",
    );
    expect(
      selectorCard.find(".player-card-main > .player-card-title").exists(),
    ).toBe(true);
    expect(
      selectorCard.find(".player-card-media-row .player-card-title").exists(),
    ).toBe(false);
    expect(selectorCard.find(".player-card-media-row").text()).toContain(
      "Hate Me Now",
    );
    expect(selectorCard.find(".player-card-actions").classes()).toContain(
      "self-end",
    );
  });

  it("anchors idle selector titles above a minimal faded speaker icon", () => {
    const wrapper = mountPlayerCard(createPlayer(), {
      stackMediaDetails: true,
    });

    expect(wrapper.classes()).not.toContain("opacity-80");
    expect(wrapper.find(".player-card-main").classes()).toContain("flex-col");
    expect(
      wrapper.find(".player-card-main > .player-card-title").exists(),
    ).toBe(true);
    expect(
      wrapper.find(".player-card-media-row .player-card-title").exists(),
    ).toBe(false);
    expect(wrapper.find(".player-card-actions").classes()).toContain(
      "self-end",
    );
    const media = wrapper.get(".player-card-media-placeholder");
    expect(media.classes()).not.toContain("border");
    expect(media.classes()).not.toContain("bg-muted");
    expect(media.classes()).not.toContain("rounded-md");
    expect(media.get(".player-icon").classes()).toContain("opacity-50");
    expect(media.get(".player-icon").classes()).toContain("text-foreground");
  });

  it("uses full speaker-icon contrast when media is selected without artwork", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        playback_state: PlaybackState.PLAYING,
        current_media: createPlayerMedia({ title: "Hate Me Now" }),
      }),
      { stackMediaDetails: true },
    );

    const icon = wrapper.get(".player-card-media-placeholder .player-icon");
    expect(icon.classes()).toContain("opacity-100");
    expect(icon.classes()).toContain("text-foreground");
  });

  it("reserves a title slot for the playing-state indicator", () => {
    const idleCard = mountPlayerCard(createPlayer(), {
      stackMediaDetails: true,
    });
    const idleIndicator = idleCard.get(".player-playback-indicator");

    expect(idleIndicator.classes()).toContain("invisible");
    expect(idleIndicator.attributes("aria-hidden")).toBe("true");
    idleCard.unmount();

    const playingCard = mountPlayerCard(
      createPlayer({ playback_state: PlaybackState.PLAYING }),
      { stackMediaDetails: true },
    );
    const playingIndicator = playingCard.get(".player-playback-indicator");

    expect(playingIndicator.classes()).not.toContain("invisible");
    expect(playingIndicator.classes()).toContain("text-primary");
    expect(playingIndicator.attributes("aria-label")).toBe("state.playing");
    expect(playingIndicator.attributes("aria-hidden")).toBe("false");
    playingCard.unmount();

    const pausedCard = mountPlayerCard(
      createPlayer({ playback_state: PlaybackState.PAUSED }),
      { stackMediaDetails: true },
    );
    const pausedIndicator = pausedCard.get(".player-playback-indicator");

    expect(pausedIndicator.classes()).toContain("invisible");
    expect(pausedIndicator.attributes("aria-hidden")).toBe("true");
  });

  it("shows the playing-state indicator beside names in unstacked cards", () => {
    const wrapper = mountPlayerCard(
      createPlayer({ playback_state: PlaybackState.PLAYING }),
    );
    const title = wrapper.get(".player-card-media-row .player-card-title");
    const indicator = title.get(".player-playback-indicator");

    expect(indicator.classes()).not.toContain("invisible");
    expect(indicator.classes()).toContain("text-primary");
    expect(indicator.attributes("aria-label")).toBe("state.playing");
  });

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
