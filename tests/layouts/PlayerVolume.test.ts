import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import { api } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getVolumeIconComponent } = vi.hoisted(() => ({
  getVolumeIconComponent: vi.fn(() => "span"),
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    playerCommandGroupVolume: vi.fn(),
    playerCommandGroupVolumeDown: vi.fn(),
    playerCommandGroupVolumeMute: vi.fn(),
    playerCommandGroupVolumeUp: vi.fn(),
    playerCommandMuteToggle: vi.fn(),
    playerCommandVolumeDown: vi.fn(),
    playerCommandVolumeSet: vi.fn(),
    playerCommandVolumeUp: vi.fn(),
  });
  return { api, default: api };
});

vi.mock("@/plugins/store", () => ({
  store: {
    isTouchscreen: false,
    mobileLayout: false,
  },
}));

vi.mock("@/helpers/utils", () => ({
  getVolumeIconComponent,
  truncateString: (value: string) => value,
}));

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "parent",
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
    supported_features: [PlayerFeature.VOLUME_SET],
    can_group_with: [],
    enabled: true,
    playback_state: PlaybackState.PLAYING,
    powered: true,
    volume_level: 25,
    volume_muted: false,
    group_members: [],
    static_group_members: [],
    source_list: [],
    sound_mode_list: [],
    options: [],
    group_volume: 25,
    group_volume_muted: false,
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

function mountGroupVolume(player: Player) {
  return mount(PlayerVolume, {
    props: {
      player,
      preferGroupVolume: true,
      enablePopout: false,
      requestExpandOnGroupTap: true,
    },
    global: {
      stubs: {
        Slider: {
          emits: ["update:modelValue"],
          template: `
            <div
              data-slot="slider"
              role="slider"
              @pointerdown="$emit('update:modelValue', [80])"
            />
          `,
        },
      },
    },
  });
}

describe("PlayerVolume group expansion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    api.players = {};
  });

  it("requests inline expansion when a group slider is clicked", async () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };
    const wrapper = mountGroupVolume(parent);

    await wrapper.find(".player-volume-container").trigger("click");

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
  });

  it("does not treat self-only membership as a group", async () => {
    const player = createPlayer({
      group_members: ["parent"],
    });
    api.players = {
      [player.player_id]: player,
    };
    const wrapper = mountGroupVolume(player);

    await wrapper.find(".player-volume-container").trigger("click");

    expect(wrapper.emitted("toggle-group-expansion")).toBeUndefined();
  });

  it("treats a group slider track click as expansion, not a volume change", async () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };
    const wrapper = mountGroupVolume(parent);
    const slider = wrapper.find('[data-slot="slider"]');

    await slider.trigger("pointerdown", {
      clientX: 80,
      pointerType: "mouse",
    });
    await slider.trigger("pointerup", {
      clientX: 80,
      pointerType: "mouse",
    });

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
    expect(api.playerCommandGroupVolume).not.toHaveBeenCalled();
  });

  it("expands on a touch tap without changing group volume", async () => {
    vi.useFakeTimers();
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };
    const wrapper = mountGroupVolume(parent);
    const slider = wrapper.find('[data-slot="slider"]');
    const container = wrapper.find(".player-volume-container");

    await slider.trigger("pointerdown", {
      clientX: 50,
      pointerType: "touch",
    });
    await container.trigger("touchstart", {
      touches: [{ clientX: 50, clientY: 10 }],
    });
    await container.trigger("touchend", {
      changedTouches: [{ clientX: 50, clientY: 10 }],
    });
    await vi.advanceTimersByTimeAsync(200);

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
    expect(api.playerCommandGroupVolume).not.toHaveBeenCalled();
  });

  it("commits a moved group slider when no debounced update was created", async () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };
    const wrapper = mountGroupVolume(parent);
    const slider = wrapper.find('[data-slot="slider"]');

    await slider.trigger("pointerdown", {
      clientX: 80,
      pointerType: "mouse",
    });
    await slider.trigger("pointermove", {
      clientX: 85,
      pointerType: "mouse",
    });
    await slider.trigger("pointerup", {
      clientX: 85,
      pointerType: "mouse",
    });

    expect(api.playerCommandGroupVolume).toHaveBeenCalledWith(
      parent.player_id,
      80,
    );
    expect(wrapper.emitted("toggle-group-expansion")).toBeUndefined();
  });

  it("uses group mute state for the group volume icon", () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
      group_volume_muted: false,
      volume_muted: true,
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };

    mountGroupVolume(parent);

    expect(getVolumeIconComponent).toHaveBeenCalledWith(parent, 25, false);
  });

  it("allows a muted group slider tap to expand child volumes", async () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
      group_volume_muted: true,
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };
    const wrapper = mountGroupVolume(parent);
    const slider = wrapper.find(".player-volume-container");

    await slider.trigger("touchstart", {
      touches: [{ clientX: 50, clientY: 10 }],
    });
    await slider.trigger("touchend", {
      changedTouches: [{ clientX: 50, clientY: 10 }],
    });

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
    expect(api.playerCommandGroupVolume).not.toHaveBeenCalled();
  });

  it("ignores horizontal swipes on a muted group slider", async () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
      group_volume_muted: true,
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };
    const wrapper = mountGroupVolume(parent);
    const slider = wrapper.find(".player-volume-container");

    await slider.trigger("touchstart", {
      touches: [{ clientX: 50, clientY: 10 }],
    });
    await slider.trigger("touchmove", {
      touches: [{ clientX: 75, clientY: 10 }],
    });
    await slider.trigger("touchend", {
      changedTouches: [{ clientX: 75, clientY: 10 }],
    });

    expect(wrapper.emitted("toggle-group-expansion")).toBeUndefined();
    expect(api.playerCommandGroupVolume).not.toHaveBeenCalled();
  });
});
