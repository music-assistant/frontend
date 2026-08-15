import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import { api, type MusicAssistantApi } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    playerCommandGroupVolume:
      vi.fn<MusicAssistantApi["playerCommandGroupVolume"]>(),
    playerCommandVolumeSet:
      vi.fn<MusicAssistantApi["playerCommandVolumeSet"]>(),
    playerCommandVolumeUp: vi.fn<MusicAssistantApi["playerCommandVolumeUp"]>(),
    playerCommandVolumeDown:
      vi.fn<MusicAssistantApi["playerCommandVolumeDown"]>(),
    playerCommandMuteToggle:
      vi.fn<MusicAssistantApi["playerCommandMuteToggle"]>(),
  });
  return { api, default: api };
});

vi.mock("@/plugins/store", () => ({
  store: {
    isTouchscreen: false,
    mobileLayout: false,
    currentUser: { user_id: "user", preferences: {} },
  },
}));

vi.mock("@/helpers/utils", () => ({
  getVolumeIconComponent: vi.fn(() => "span"),
  truncateString: (value: string) => value,
}));

// The drag tests leave timers pending, so a leaked instance would keep firing
// them into later tests.
enableAutoUnmount(afterEach);

const START_VOLUME = 30;
// A 200px track makes the position arithmetic exact on the 2% step grid:
// clientX 140 is 70% of the track.
const SLIDER_WIDTH = 200;

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
    supported_features: [PlayerFeature.VOLUME_SET],
    can_group_with: [],
    enabled: true,
    playback_state: PlaybackState.PLAYING,
    powered: true,
    volume_level: START_VOLUME,
    volume_muted: false,
    group_members: [],
    static_group_members: [],
    source_list: [],
    sound_mode_list: [],
    options: [],
    group_volume: START_VOLUME,
    group_volume_muted: false,
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
    ...overrides,
  };
}

function mountVolume(
  props: Record<string, unknown> = {},
  player: Player = createPlayer(),
) {
  if (!api.players[player.player_id]) {
    api.players = { [player.player_id]: player };
  }

  const wrapper = mount(PlayerVolume, {
    props: { player, ...props },
    global: {
      stubs: {
        Slider: {
          emits: ["update:modelValue"],
          template: `<div data-slot="slider" role="slider" />`,
        },
      },
    },
  });

  // happy-dom reports a zero-width rect, which would make every position
  // calculation divide by zero. Give the container a real width instead.
  const container = wrapper.find(".player-volume-container");
  (container.element as HTMLElement).getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: SLIDER_WIDTH,
      bottom: 40,
      width: SLIDER_WIDTH,
      height: 40,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  return { wrapper, container, player };
}

const touchAt = (container: ReturnType<typeof mountVolume>["container"]) => ({
  start: (clientX: number) =>
    container.trigger("touchstart", { touches: [{ clientX, clientY: 10 }] }),
  move: (clientX: number) =>
    container.trigger("touchmove", { touches: [{ clientX, clientY: 10 }] }),
  end: (clientX: number) =>
    container.trigger("touchend", {
      changedTouches: [{ clientX, clientY: 10 }],
    }),
});

const shownVolume = (wrapper: ReturnType<typeof mountVolume>["wrapper"]) =>
  Number(wrapper.find(".volume-level-text").text());

describe("PlayerVolume live volume while dragging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.players = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends during a touch drag rather than only on release", async () => {
    const { container, player } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);

    // Already sent, with no touchend yet: 140/200 of the track.
    expect(api.playerCommandVolumeSet).toHaveBeenCalledWith(
      player.player_id,
      70,
    );
  });

  it("settles on the exact final value on release", async () => {
    const { container, wrapper, player } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    await touch.end(150);

    expect(shownVolume(wrapper)).toBe(76);
    expect(api.playerCommandVolumeSet).toHaveBeenLastCalledWith(
      player.player_id,
      76,
    );
  });

  it("does not repeat the value already sent when the drag ends where it was", async () => {
    const { container } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    await touch.end(140);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for a tap that never becomes a drag", async () => {
    const child = createPlayer({ player_id: "child", name: "Office" });
    const parent = createPlayer({ group_members: ["parent", "child"] });
    api.players = { parent, child };

    const { container, wrapper } = mountVolume(
      {
        preferGroupVolume: true,
        enablePopout: false,
        requestExpandOnGroupTap: true,
      },
      parent,
    );
    const touch = touchAt(container);

    await touch.start(100);
    await touch.end(100);

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
    expect(api.playerCommandGroupVolume).not.toHaveBeenCalled();
  });

  it("settles at the dragged value when the drag is cancelled", async () => {
    const { container, wrapper, player } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    await container.trigger("touchcancel");

    // The volume has already changed audibly, so it stays where it left off
    // rather than snapping back to the start.
    expect(shownVolume(wrapper)).toBe(70);
    expect(api.playerCommandVolumeSet).toHaveBeenLastCalledWith(
      player.player_id,
      70,
    );
  });

  it("does not let a pending send follow the cancel that settled the drag", async () => {
    vi.useFakeTimers();
    const { container } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    await touch.move(150); // schedules a trailing send
    await container.trigger("touchcancel");

    const callsAtCancel = vi.mocked(api.playerCommandVolumeSet).mock.calls
      .length;
    await vi.advanceTimersByTimeAsync(200);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(callsAtCancel);
  });

  it("sends nothing when a swipe on a muted group slider is cancelled", async () => {
    const child = createPlayer({ player_id: "child", name: "Office" });
    const parent = createPlayer({
      group_members: ["parent", "child"],
      group_volume_muted: true,
    });
    api.players = { parent, child };

    const { container } = mountVolume(
      {
        preferGroupVolume: true,
        enablePopout: false,
        requestExpandOnGroupTap: true,
      },
      parent,
    );
    const touch = touchAt(container);

    // A muted slider still tracks the swipe so it can tell a drag from a tap,
    // but there is no value for the cancel to settle on.
    await touch.start(100);
    await touch.move(140);
    await container.trigger("touchcancel");

    expect(api.playerCommandGroupVolume).not.toHaveBeenCalled();
  });

  it("throttles to one send per 100ms while the drag continues", async () => {
    vi.useFakeTimers();
    const { container, player } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    // Leading edge goes out immediately.
    await touch.move(140);
    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(1);

    // Inside the window: held, not sent.
    await touch.move(150);
    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(1);

    // The trailing edge lands at 100ms with the latest position.
    await vi.advanceTimersByTimeAsync(100);
    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(2);
    expect(api.playerCommandVolumeSet).toHaveBeenLastCalledWith(
      player.player_id,
      76,
    );
  });

  it("sends at once on a new drag instead of waiting out the previous window", async () => {
    vi.useFakeTimers();
    const { container, player } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    await touch.end(140);
    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(1);

    // A second drag well inside the first window still responds immediately.
    await vi.advanceTimersByTimeAsync(20);
    await touch.start(140);
    await touch.move(100);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(2);
    expect(api.playerCommandVolumeSet).toHaveBeenLastCalledWith(
      player.player_id,
      50,
    );
  });

  it("drops a pending send when the drag returns to the value already sent", async () => {
    vi.useFakeTimers();
    const { container } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140); // leading edge sends 70
    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(1);

    await touch.move(150); // schedules a trailing send for 76
    await touch.move(140); // back to 70, so that trailing send is moot

    await vi.advanceTimersByTimeAsync(200);
    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(1);
  });

  it("clears a pending send when the component unmounts mid-drag", async () => {
    vi.useFakeTimers();
    const { container, wrapper } = mountVolume();
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    await touch.move(150); // schedules a trailing send
    wrapper.unmount();

    const callsAtUnmount = vi.mocked(api.playerCommandVolumeSet).mock.calls
      .length;
    await vi.advanceTimersByTimeAsync(200);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(callsAtUnmount);
  });
});

// One group volume command is set on every member in parallel and each member's
// state change is broadcast to every client, so the window widens with the group.
describe("PlayerVolume live send throttle on a group", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.players = {};
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mountGroup(memberCount: number) {
    const ids = Array.from({ length: memberCount - 1 }, (_, i) => `child${i}`);
    const parent = createPlayer({ group_members: ["parent", ...ids] });
    api.players = { parent };
    for (const id of ids) {
      api.players[id] = createPlayer({ player_id: id, name: `Player ${id}` });
    }
    // childPlayers includes the leader itself for a sync leader, so a two-member
    // group is the parent plus one child.
    return mountVolume(
      { preferGroupVolume: true, enablePopout: false },
      parent,
    );
  }

  it("widens the window to 200ms for a two-member group", async () => {
    vi.useFakeTimers();
    const { container, player } = mountGroup(2);
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    expect(api.playerCommandGroupVolume).toHaveBeenCalledTimes(1);

    await touch.move(150);
    // A single player would have sent again by now; a two-member group must not.
    await vi.advanceTimersByTimeAsync(100);
    expect(api.playerCommandGroupVolume).toHaveBeenCalledTimes(1);

    // The trailing edge lands at 200ms instead.
    await vi.advanceTimersByTimeAsync(100);
    expect(api.playerCommandGroupVolume).toHaveBeenCalledTimes(2);
    expect(api.playerCommandGroupVolume).toHaveBeenLastCalledWith(
      player.player_id,
      76,
    );
  });

  it("caps the window at 500ms however large the group", async () => {
    vi.useFakeTimers();
    const { container } = mountGroup(8);
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    expect(api.playerCommandGroupVolume).toHaveBeenCalledTimes(1);

    await touch.move(150);
    // Uncapped this would be 800ms, so nothing at 400ms...
    await vi.advanceTimersByTimeAsync(400);
    expect(api.playerCommandGroupVolume).toHaveBeenCalledTimes(1);

    // ...and the trailing send at 500ms rather than waiting out 800ms.
    await vi.advanceTimersByTimeAsync(100);
    expect(api.playerCommandGroupVolume).toHaveBeenCalledTimes(2);
  });

  it("still sends immediately on release despite the wider window", async () => {
    vi.useFakeTimers();
    const { container, player } = mountGroup(4);
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    await touch.move(150);
    // Release without advancing timers: sendVolumeFinal bypasses the throttle.
    await touch.end(150);

    expect(api.playerCommandGroupVolume).toHaveBeenCalledTimes(2);
    expect(api.playerCommandGroupVolume).toHaveBeenLastCalledWith(
      player.player_id,
      76,
    );
  });
});
