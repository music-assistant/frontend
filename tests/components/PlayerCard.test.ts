import PlayerCard from "@/components/PlayerCard.vue";
import {
  IdentifierType,
  MediaType,
  PlaybackState,
  type Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { apiMock, emitContextMenu } = vi.hoisted(() => ({
  apiMock: {
    queues: {} as Record<
      string,
      {
        extra_attributes?: {
          play_action_in_progress?: boolean;
        };
        items?: number;
      }
    >,
    playerCommandPlayPause: vi.fn(),
    playerCommandPowerToggle: vi.fn(),
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
  getPlayerName: (player: Player) => player.name,
  isBuiltinPlayer: () => false,
}));

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
  emits: ["toggle-child-volumes"],
  template: `
    <button
      class="volume-control"
      @click="$emit('toggle-child-volumes')"
    />
  `,
};

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
    icon: "speaker",
    power_control: "power",
    volume_control: "volume",
    mute_control: "mute",
    needs_setup: false,
    output_protocols: [],
    active_output_protocol: null,
    ...overrides,
  };
}

function mountPlayerCard(player: Player) {
  return mount(PlayerCard, {
    props: {
      player,
      allowPowerControl: true,
      showGroupControls: true,
      showMenuButton: true,
      showVolumeControl: true,
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
  it("uses a primary border for the active player", () => {
    const wrapper = mountPlayerCard(
      createPlayer({
        player_id: "active",
      }),
    );

    expect(wrapper.classes()).toContain("border-primary");
  });

  it("keeps the player details in the selection action name", () => {
    const wrapper = mountPlayerCard(createPlayer());
    const action = wrapper.find(".player-select-action");

    expect(action.attributes("aria-label")).toBeUndefined();
    expect(action.text()).toContain("tooltip.select_player");
    expect(action.text()).toContain("Kitchen");
  });

  it.each([PlaybackState.PLAYING, PlaybackState.PAUSED])(
    "shows artwork while %s",
    (playbackState) => {
      const wrapper = mountPlayerCard(
        createPlayer({
          playback_state: playbackState,
          current_media: {
            uri: "test://track",
            media_type: MediaType.TRACK,
            image_url: "https://example.test/cover.jpg",
          },
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
        current_media: {
          uri: "test://track",
          media_type: MediaType.TRACK,
          image_url: "https://example.test/cover.jpg",
        },
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
    expect(wrapper.emitted("toggle-member-controls")).toEqual([[player]]);
    expect(wrapper.emitted("toggle-child-volumes")).toEqual([[player]]);
    expect(emitContextMenu).toHaveBeenCalledWith(
      "contextmenu",
      expect.objectContaining({
        posX: 1,
        posY: 2,
      }),
    );
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
