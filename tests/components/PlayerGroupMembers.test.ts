import PlayerGroupMembers from "@/components/PlayerGroupMembers.vue";
import type { PlayerGroupFilter } from "@/helpers/player_group";
import { api, type MusicAssistantApi } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestGroupPlaybackConfirmation } = vi.hoisted(() => ({
  requestGroupPlaybackConfirmation: vi.fn(),
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    getPlayer: vi.fn<MusicAssistantApi["getPlayer"]>(),
    playerCommandSetMembers: vi.fn<
      MusicAssistantApi["playerCommandSetMembers"]
    >(() => Promise.resolve()),
  });
  return { api, default: api };
});

vi.mock("@/helpers/players", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/players")>()),
  groupMemberPickerVisible: () => true,
}));

vi.mock("@/helpers/player_group_playback", () => ({
  requestGroupPlaybackConfirmation,
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

function mountGroupMembers(
  player: Player,
  members: Player[],
  props: {
    filter?: PlayerGroupFilter;
    groupHeading?: string;
  } = {},
) {
  return mount(PlayerGroupMembers, {
    props: {
      player,
      members,
      ...props,
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
    requestGroupPlaybackConfirmation.mockReturnValue(false);
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

  it("separates players, lights, and screens", () => {
    const speaker = createPlayer({
      player_id: "speaker",
      name: "Office",
    });
    const light = createPlayer({
      player_id: "light",
      name: "Kitchen light",
      type: PlayerType.LIGHT,
    });
    const visualizer = createPlayer({
      player_id: "visualizer",
      name: "TV visualizer",
      type: PlayerType.VISUALIZER,
    });
    const parent = createPlayer({
      can_group_with: [
        speaker.player_id,
        light.player_id,
        visualizer.player_id,
      ],
    });
    api.players = {
      [parent.player_id]: parent,
      [speaker.player_id]: speaker,
      [light.player_id]: light,
      [visualizer.player_id]: visualizer,
    };

    const wrapper = mountGroupMembers(parent, []);

    expect(
      wrapper
        .findAll(".player-group-section > p")
        .map((section) => section.text()),
    ).toEqual(["players", "lights", "screens"]);
  });

  it("lists a display player under screens", () => {
    const screen = createPlayer({
      player_id: "screen",
      name: "Kitchen screen",
      type: PlayerType.DISPLAY,
    });
    const parent = createPlayer({ can_group_with: [screen.player_id] });
    api.players = {
      [parent.player_id]: parent,
      [screen.player_id]: screen,
    };

    const wrapper = mountGroupMembers(parent, []);

    expect(
      wrapper
        .findAll(".player-group-section > p")
        .map((section) => section.text()),
    ).toEqual(["screens"]);
  });

  it("keeps only screens when filtering on screens", () => {
    const speaker = createPlayer({
      player_id: "speaker",
      name: "Office",
    });
    const screen = createPlayer({
      player_id: "screen",
      name: "Kitchen screen",
      type: PlayerType.DISPLAY,
    });
    const parent = createPlayer({
      can_group_with: [speaker.player_id, screen.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [speaker.player_id]: speaker,
      [screen.player_id]: screen,
    };

    const wrapper = mountGroupMembers(parent, [], { filter: "screens" });

    expect(
      wrapper
        .findAll(".member-checkbox")
        .map((checkbox) => checkbox.attributes("aria-label")),
    ).toEqual(["Kitchen screen"]);
  });

  it("separates current members from available players", () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const available = createPlayer({
      player_id: "available",
      name: "Bedroom",
    });
    const parent = createPlayer({
      can_group_with: [available.player_id],
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
      [available.player_id]: available,
    };

    const wrapper = mountGroupMembers(parent, [parent, child], {
      groupHeading: parent.name,
    });

    expect(
      wrapper
        .findAll(".player-group-section > p")
        .map((section) => section.text()),
    ).toEqual(["Kitchen", "players"]);
  });

  it("keeps current members visible while filtering candidates", () => {
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

    const wrapper = mountGroupMembers(parent, [parent, child], {
      filter: "lights",
      groupHeading: "Players in group",
    });

    expect(
      wrapper
        .findAll(".member-checkbox")
        .map((checkbox) => checkbox.attributes("aria-label")),
    ).toEqual(["Kitchen", "Office"]);
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

  it("sends pending group changes before unmounting", async () => {
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
    expect(api.playerCommandSetMembers).not.toHaveBeenCalled();

    wrapper.unmount();

    expect(api.playerCommandSetMembers).toHaveBeenCalledWith(
      parent.player_id,
      [candidate.player_id],
      undefined,
    );
    await vi.runAllTimersAsync();
    expect(api.playerCommandSetMembers).toHaveBeenCalledTimes(1);
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

  it("waits for a choice before removing the playing leader", async () => {
    vi.useFakeTimers();
    let keepPlaying: (() => void) | undefined;
    requestGroupPlaybackConfirmation.mockImplementation(
      (_player, _change, onKeepPlaying) => {
        keepPlaying = onKeepPlaying;
        return true;
      },
    );
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      playback_state: PlaybackState.PLAYING,
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };
    const wrapper = mountGroupMembers(parent, [parent, child]);

    await wrapper.get('[aria-label="Kitchen"]').trigger("click");

    expect(requestGroupPlaybackConfirmation).toHaveBeenCalledWith(
      parent,
      "remove",
      expect.any(Function),
    );
    expect(parent.group_members).toEqual(["parent", child.player_id]);
    expect(api.playerCommandSetMembers).not.toHaveBeenCalled();

    keepPlaying?.();
    expect(parent.group_members).toEqual([child.player_id]);
    await vi.advanceTimersByTimeAsync(500);
    expect(api.playerCommandSetMembers).toHaveBeenCalledWith(
      parent.player_id,
      undefined,
      [parent.player_id],
    );
  });
});
