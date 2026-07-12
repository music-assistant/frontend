import PlayerGroupMembers from "@/components/PlayerGroupMembers.vue";
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

const CheckboxStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: `
    <button
      class="member-checkbox"
      @click="$emit('update:modelValue', !modelValue)"
    />
  `,
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
    supported_features: [PlayerFeature.SET_MEMBERS],
    can_group_with: [],
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

function mountGroupMembers(player: Player, members: Player[]) {
  return mount(PlayerGroupMembers, {
    props: {
      player,
      members,
    },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
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

describe("PlayerGroupMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    api.players = {};
  });

  it("uses aligned icon slots and prominent checkboxes", () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
      powered: false,
    });
    const parent = createPlayer({
      can_group_with: [child.player_id],
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };
    const wrapper = mountGroupMembers(parent, [child]);

    expect(wrapper.find(".player-group-member-icon").classes()).toEqual(
      expect.arrayContaining(["h-6", "w-[30px]"]),
    );
    expect(wrapper.find(".player-group-member").classes()).not.toContain(
      "opacity-50",
    );
    expect(wrapper.find(".player-group-member-icon").html()).toContain(
      "opacity-50",
    );
    expect(wrapper.find(".member-checkbox").classes()).toEqual(
      expect.arrayContaining(["size-5", "border-2"]),
    );
  });

  it("optimistically joins a player and sends the grouped update", async () => {
    vi.useFakeTimers();
    const candidate = createPlayer({
      player_id: "candidate",
      name: "Office",
    });
    const parent = createPlayer({
      can_group_with: [candidate.player_id],
      group_members: ["parent"],
    });
    api.players = {
      [parent.player_id]: parent,
      [candidate.player_id]: candidate,
    };
    const wrapper = mountGroupMembers(parent, []);

    await wrapper.find(".member-checkbox").trigger("click");
    expect(parent.group_members).toContain(candidate.player_id);

    await vi.advanceTimersByTimeAsync(500);
    expect(api.playerCommandSetMembers).toHaveBeenCalledWith(
      parent.player_id,
      [candidate.player_id],
      undefined,
    );
  });

  it("normalizes self-only membership after removing the final child", async () => {
    vi.useFakeTimers();
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
    const wrapper = mountGroupMembers(parent, [child]);

    await wrapper.find(".member-checkbox").trigger("click");

    expect(parent.group_members).toEqual([]);
    await vi.advanceTimersByTimeAsync(500);
    expect(api.playerCommandSetMembers).toHaveBeenCalledWith(
      parent.player_id,
      undefined,
      [child.player_id],
    );
  });
});
