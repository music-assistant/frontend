import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import { api } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    playerCommandGroupVolume: vi.fn(),
    playerCommandVolumeSet: vi.fn(),
    playerCommandVolumeUp: vi.fn(),
    playerCommandVolumeDown: vi.fn(),
    playerCommandMuteToggle: vi.fn(),
  });
  return { api, default: api };
});

// Reactive so that flipping volume_slider_mode between tests invalidates the
// isRelativeMode computed rather than serving a cached value.
vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      isTouchscreen: false,
      mobileLayout: false,
      currentUser: {
        user_id: "user",
        preferences: {} as Record<string, unknown>,
      },
    }),
  };
});

vi.mock("@/helpers/utils", () => ({
  getVolumeIconComponent: vi.fn(() => "span"),
  truncateString: (value: string) => value,
}));

// The mouse tests attach document-level listeners, so a leaked instance would
// keep reacting to later tests' events.
enableAutoUnmount(afterEach);

const prefs = () =>
  (
    store as unknown as {
      currentUser: { preferences: Record<string, unknown> };
    }
  ).currentUser.preferences;

const START_VOLUME = 30;
// Chosen so the relative arithmetic lands exactly on the 2% step grid:
// a 40px drag is 40/200 * 100 * 0.5 = 10 volume points.
const SLIDER_WIDTH = 200;
const DRAG_PX = 40;
const DRAG_POINTS = 10;

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

function mountVolume(
  mode: "relative" | "absolute",
  props: Record<string, unknown> = {},
  player: Player = createPlayer(),
) {
  prefs().volume_slider_mode = mode;
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

  // happy-dom reports a zero-width rect, which would make every relative delta
  // divide by zero. Give the container a real width instead.
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

// buttons: 1 is what a real browser reports while the left button is held; a
// move without it means the release was missed.
const mouseMove = (clientX: number, buttons = 1) =>
  document.dispatchEvent(new MouseEvent("mousemove", { clientX, buttons }));
const mouseUp = (clientX: number) =>
  document.dispatchEvent(new MouseEvent("mouseup", { clientX }));

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

describe("PlayerVolume relative mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.players = {};
    prefs().volume_slider_mode = "relative";
  });

  it("adjusts by the distance dragged, from the value the drag started at", async () => {
    const { container, player } = mountVolume("relative");

    await container.trigger("mousedown", { clientX: 100 });
    mouseMove(100 + DRAG_PX);
    mouseUp(100 + DRAG_PX);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledWith(
      player.player_id,
      START_VOLUME + DRAG_POINTS,
    );
  });

  it("reaches the same value regardless of where the drag began", async () => {
    const near = mountVolume("relative");
    await near.container.trigger("mousedown", { clientX: 20 });
    mouseMove(20 + DRAG_PX);
    mouseUp(20 + DRAG_PX);

    api.players = {};
    const far = mountVolume("relative");
    await far.container.trigger("mousedown", { clientX: 150 });
    mouseMove(150 + DRAG_PX);
    mouseUp(150 + DRAG_PX);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(2);
    expect(api.playerCommandVolumeSet).toHaveBeenNthCalledWith(
      1,
      "parent",
      START_VOLUME + DRAG_POINTS,
    );
    expect(api.playerCommandVolumeSet).toHaveBeenNthCalledWith(
      2,
      "parent",
      START_VOLUME + DRAG_POINTS,
    );
  });

  it("sends the volume once, on release", async () => {
    const { container, wrapper, player } = mountVolume("relative");

    await container.trigger("mousedown", { clientX: 100 });
    mouseMove(110);
    mouseMove(120);
    mouseMove(130);
    mouseMove(140);
    await wrapper.vm.$nextTick();

    // The readout follows the pointer, but nothing has been sent yet.
    expect(shownVolume(wrapper)).toBe(START_VOLUME + DRAG_POINTS);
    expect(api.playerCommandVolumeSet).not.toHaveBeenCalled();

    mouseUp(140);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledTimes(1);
    expect(api.playerCommandVolumeSet).toHaveBeenCalledWith(
      player.player_id,
      START_VOLUME + DRAG_POINTS,
    );
  });

  it("measures a touch drag from the point it was recognised", async () => {
    const { container, player } = mountVolume("relative");
    const touch = touchAt(container);

    await touch.start(100);
    // 9px crosses the 8px mark and latches the drag; the anchor moves here, so
    // this travel is not itself a volume change.
    await touch.move(109);
    await touch.move(109 + DRAG_PX);
    await touch.end(109 + DRAG_PX);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledWith(
      player.player_id,
      START_VOLUME + DRAG_POINTS,
    );
  });

  it("leaves the volume alone while a touch gesture is below the drag threshold", async () => {
    const { container, wrapper } = mountVolume("relative");
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(105);

    expect(shownVolume(wrapper)).toBe(START_VOLUME);
    expect(api.playerCommandVolumeSet).not.toHaveBeenCalled();
  });

  it("treats a short mouse gesture on a grouped player as a tap", async () => {
    const child = createPlayer({ player_id: "child", name: "Office" });
    const parent = createPlayer({ group_members: ["parent", "child"] });
    api.players = { parent, child };

    const { container, wrapper } = mountVolume(
      "relative",
      {
        preferGroupVolume: true,
        enablePopout: false,
        requestExpandOnGroupTap: true,
      },
      parent,
    );

    await container.trigger("mousedown", { clientX: 100 });
    mouseUp(102);

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
    expect(api.playerCommandGroupVolume).not.toHaveBeenCalled();
  });

  it("runs the group action once for a tap that also emits mouse events", async () => {
    const child = createPlayer({ player_id: "child", name: "Office" });
    const parent = createPlayer({ group_members: ["parent", "child"] });
    api.players = { parent, child };

    const { container, wrapper } = mountVolume(
      "relative",
      {
        preferGroupVolume: true,
        enablePopout: false,
        requestExpandOnGroupTap: true,
      },
      parent,
    );

    // a touchscreen tap: touchend runs the action, then the browser replays the
    // gesture as compatibility mouse events
    await container.trigger("touchstart", {
      touches: [{ clientX: 100, clientY: 10 }],
    });
    await container.trigger("touchend", {
      changedTouches: [{ clientX: 100, clientY: 10 }],
    });
    await container.trigger("mousedown", { clientX: 100 });
    mouseUp(100);

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
  });

  it("still opens the group controls on a muted slider", async () => {
    const child = createPlayer({ player_id: "child", name: "Office" });
    const parent = createPlayer({
      group_members: ["parent", "child"],
      group_volume_muted: true,
    });
    api.players = { parent, child };

    const { container, wrapper } = mountVolume(
      "relative",
      {
        preferGroupVolume: true,
        enablePopout: false,
        requestExpandOnGroupTap: true,
      },
      parent,
    );

    await container.trigger("mousedown", { clientX: 100 });
    mouseUp(102);

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
    expect(api.playerCommandGroupVolume).not.toHaveBeenCalled();
  });

  it("ignores a right click", async () => {
    const { container, wrapper } = mountVolume("relative");

    await container.trigger("mousedown", { clientX: 100, button: 2 });
    mouseMove(140);
    mouseUp(140);
    await wrapper.vm.$nextTick();

    expect(shownVolume(wrapper)).toBe(START_VOLUME);
    expect(api.playerCommandVolumeSet).not.toHaveBeenCalled();
  });

  it("ends the drag when the release was missed", async () => {
    const { container, wrapper, player } = mountVolume("relative");

    await container.trigger("mousedown", { clientX: 100 });
    mouseMove(140);
    // no mouseup: a context menu or window switch swallowed it, so the next
    // move arrives with no button held
    mouseMove(150, 0);
    await wrapper.vm.$nextTick();

    const settled = shownVolume(wrapper);
    expect(api.playerCommandVolumeSet).toHaveBeenCalledWith(
      player.player_id,
      settled,
    );

    // the drag is over, so a later hover must not keep moving the volume
    mouseMove(200, 0);
    await wrapper.vm.$nextTick();
    expect(shownVolume(wrapper)).toBe(settled);
  });
});

describe("PlayerVolume absolute mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.players = {};
    prefs().volume_slider_mode = "absolute";
  });

  it("does not start a container drag on mousedown", async () => {
    const { container } = mountVolume("absolute");

    await container.trigger("mousedown", { clientX: 100 });
    mouseMove(140);
    mouseUp(140);

    expect(api.playerCommandVolumeSet).not.toHaveBeenCalled();
  });

  it("maps a touch drag onto the pointer position", async () => {
    const { container, player } = mountVolume("absolute");
    const touch = touchAt(container);

    await touch.start(100);
    await touch.move(140);
    await touch.end(140);

    // 140/200 of the track, not a 40px delta applied to the start value.
    expect(api.playerCommandVolumeSet).toHaveBeenCalledWith(
      player.player_id,
      70,
    );
  });
});
