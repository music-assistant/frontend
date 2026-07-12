import VolumeControl from "@/components/VolumeControl.vue";
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

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    getPlayer: vi.fn(),
    playerCommandSetMembers: vi.fn(() => Promise.resolve()),
  });
  return { api, default: api };
});

vi.mock("@/helpers/utils", () => ({
  groupMemberPickerVisible: () => true,
}));

vi.mock("@/layouts/default/PlayerOSD/PlayerVolume.vue", () => ({
  default: {
    props: ["player"],
    emits: ["toggle-group-expansion"],
    template: `
      <button
        class="player-volume"
        :data-player-id="player.player_id"
        @click="$emit('toggle-group-expansion')"
      />
    `,
  },
}));

const CheckboxStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: '<button class="member-checkbox" />',
};

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
    supported_features: [PlayerFeature.SET_MEMBERS, PlayerFeature.VOLUME_SET],
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

function mountVolumeControl(
  player: Player,
  props: {
    showChildVolumes?: boolean;
    showMemberControls?: boolean;
    showVolumeControl?: boolean;
  },
) {
  return mount(VolumeControl, {
    props: {
      player,
      showVolumeControl: props.showVolumeControl ?? true,
      ...props,
    },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        Button: {
          template: "<button><slot /></button>",
        },
        Checkbox: CheckboxStub,
        PlayerIcon: {
          template: "<span />",
        },
        Separator: {
          template: "<hr />",
        },
      },
    },
  });
}

describe("VolumeControl", () => {
  beforeEach(() => {
    api.players = {};
  });

  it("shows child sliders without group-member checkboxes", () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      can_group_with: [child.player_id],
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };

    const wrapper = mountVolumeControl(parent, {
      showChildVolumes: true,
      showMemberControls: false,
    });

    expect(
      wrapper
        .findAll(".player-volume")
        .map((volume) => volume.attributes("data-player-id")),
    ).toEqual(["parent", "parent", "child"]);
    expect(wrapper.find(".member-checkbox").exists()).toBe(false);
  });

  it("does not show child-volume expansion for a standalone player", () => {
    const player = createPlayer({
      group_members: ["parent"],
    });
    api.players = { [player.player_id]: player };

    const wrapper = mountVolumeControl(player, {});

    expect(wrapper.findAll(".player-volume")).toHaveLength(1);
    expect(
      wrapper.find('[aria-label="tooltip.toggle_subplayers"]').exists(),
    ).toBe(false);
  });

  it("hides expanded child volumes when the parent is powered off", () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
      powered: false,
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };

    const wrapper = mountVolumeControl(parent, {
      showChildVolumes: true,
      showVolumeControl: false,
    });

    expect(wrapper.find(".player-volume").exists()).toBe(false);
  });

  it("shows member checkboxes without child sliders", () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      can_group_with: [child.player_id],
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };

    const wrapper = mountVolumeControl(parent, {
      showChildVolumes: false,
      showMemberControls: true,
    });

    expect(wrapper.findAll(".player-volume")).toHaveLength(1);
    expect(wrapper.findAll(".member-checkbox")).toHaveLength(1);
  });

  it("forwards group slider taps as child-volume toggles", async () => {
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
    const wrapper = mountVolumeControl(parent, {});

    await wrapper.find(".player-volume").trigger("click");

    expect(wrapper.emitted("toggle-child-volumes")).toEqual([[parent]]);
  });
});
