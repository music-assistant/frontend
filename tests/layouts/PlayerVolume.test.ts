import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import { api, type MusicAssistantApi } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const { getVolumeIconComponent } = vi.hoisted(() => ({
  getVolumeIconComponent: vi.fn(() => "span"),
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    playerCommandGroupVolume:
      vi.fn<MusicAssistantApi["playerCommandGroupVolume"]>(),
    playerCommandGroupVolumeDown:
      vi.fn<MusicAssistantApi["playerCommandGroupVolumeDown"]>(),
    playerCommandGroupVolumeMute:
      vi.fn<MusicAssistantApi["playerCommandGroupVolumeMute"]>(),
    playerCommandGroupVolumeUp:
      vi.fn<MusicAssistantApi["playerCommandGroupVolumeUp"]>(),
    playerCommandMuteToggle:
      vi.fn<MusicAssistantApi["playerCommandMuteToggle"]>(),
    playerCommandVolumeDown:
      vi.fn<MusicAssistantApi["playerCommandVolumeDown"]>(),
    playerCommandVolumeSet:
      vi.fn<MusicAssistantApi["playerCommandVolumeSet"]>(),
    playerCommandVolumeUp: vi.fn<MusicAssistantApi["playerCommandVolumeUp"]>(),
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

const sliderStub = {
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
};

function mountGroupVolume(player: Player) {
  return mount(PlayerVolume, {
    props: {
      player,
      preferGroupVolume: true,
      enablePopout: false,
      requestExpandOnGroupTap: true,
    },
    global: {
      stubs: sliderStub,
    },
  });
}

function mountPopoutVolume(player: Player) {
  return mount(PlayerVolume, {
    props: {
      player,
      preferGroupVolume: true,
    },
    global: {
      stubs: sliderStub,
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

describe("PlayerVolume group popout", () => {
  // the popout is anchored to the bottom of the slider, so this is both the
  // room it has above it and the point it grows up from
  const SLIDER_BOTTOM = 700;

  function mountLargeGroup() {
    const children = ["Office", "Kitchen", "Bedroom", "Bathroom", "Study"].map(
      (name) => createPlayer({ player_id: name.toLowerCase(), name }),
    );
    const parent = createPlayer({
      type: PlayerType.GROUP,
      group_members: children.map((child) => child.player_id),
    });
    api.players = Object.fromEntries(
      [parent, ...children].map((player) => [player.player_id, player]),
    );
    return { children, wrapper: mountPopoutVolume(parent) };
  }

  const originalInnerHeight = Object.getOwnPropertyDescriptor(
    window,
    "innerHeight",
  );

  beforeEach(() => {
    vi.clearAllMocks();
    api.players = {};
    store.mobileLayout = false;
    Object.defineProperty(window, "innerHeight", {
      value: 768,
      writable: true,
      configurable: true,
    });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      top: SLIDER_BOTTOM - 40,
      bottom: SLIDER_BOTTOM,
      left: 100,
      right: 300,
      width: 200,
      height: 40,
    } as DOMRect);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalInnerHeight) {
      Object.defineProperty(window, "innerHeight", originalInnerHeight);
    }
    store.mobileLayout = false;
    document.body.innerHTML = "";
  });

  async function openPopout(wrapper: ReturnType<typeof mountPopoutVolume>) {
    await wrapper.find(".player-volume-container").trigger("click");
    return document.body.querySelector<HTMLElement>(".group-popout")!;
  }

  // a diagonal swipe the browser may claim for the popout's own scrolling: far
  // enough sideways to read as a slider drag, but not steep enough for the
  // component's own scroll detection to catch it
  const DIAGONAL = { from: { x: 150, y: 100 }, to: { x: 190, y: 116 } };
  // where DIAGONAL.to lands on the mocked slider, rounded to the default step
  const DRAGGED_VOLUME = 46;

  function touchEvent(type: string, x: number, y: number, cancelable = true) {
    const event = new Event(type, { bubbles: true, cancelable });
    const touch = { clientX: x, clientY: y };
    return Object.assign(event, { touches: [touch], changedTouches: [touch] });
  }

  // the first row's player, whose id mountLargeGroup derives from its name
  function firstRow(popout: HTMLElement) {
    const row = popout.querySelector<HTMLElement>(".group-popout-row")!;
    const name = row.querySelector(".group-popout-label")!.textContent!.trim();
    return {
      container: row.querySelector<HTMLElement>(".player-volume-container")!,
      level: () => row.querySelector(".volume-level-text")!.textContent!.trim(),
      playerId: name.toLowerCase(),
    };
  }

  async function swipeRow(row: HTMLElement, cancelable: boolean) {
    const { from, to } = DIAGONAL;
    row.dispatchEvent(touchEvent("touchstart", from.x, from.y));
    row.dispatchEvent(touchEvent("touchmove", to.x, to.y, cancelable));
    row.dispatchEvent(touchEvent("touchend", to.x, to.y));
    await nextTick();
  }

  it("caps the popout at the room above the slider", async () => {
    const { children, wrapper } = mountLargeGroup();

    const popout = await openPopout(wrapper);

    expect(popout).not.toBeNull();
    expect(popout.querySelectorAll(".group-popout-label")).toHaveLength(
      children.length,
    );
    expect(popout.style.maxHeight).toBe("692px");
    // pins the desktop branch, which the shared cap alone cannot tell apart
    expect(popout.style.width).toBe("300px");
    expect(popout.style.right).toBe("");
  });

  it("caps the popout at the room above the slider on mobile", async () => {
    store.mobileLayout = true;
    const { wrapper } = mountLargeGroup();

    const popout = await openPopout(wrapper);

    expect(popout.style.maxHeight).toBe("692px");
    expect(popout.style.right).toBe("8px");
    expect(popout.style.width).toBe("");
  });

  it("opens at the group slider so it still overlaps the tapped one", async () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(900);
    const { wrapper } = mountLargeGroup();

    const popout = await openPopout(wrapper);
    await nextTick();

    expect(popout.scrollTop).toBe(900);
  });

  it("leaves the wheel to scroll the popout rows", async () => {
    const { wrapper } = mountLargeGroup();
    const popout = await openPopout(wrapper);
    const row = popout.querySelector<HTMLElement>(".player-volume-container")!;

    const event = new WheelEvent("wheel", {
      deltaY: 120,
      bubbles: true,
      cancelable: true,
    });
    row.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("nests the rows the way the touch-action override selects them", async () => {
    const { wrapper } = mountLargeGroup();

    const popout = await openPopout(wrapper);

    // the override in the component's unscoped block names the wrapper as well,
    // to out-rank the scoped rule; flattening a row would silently drop it
    expect(
      popout.querySelector(
        ".group-popout .player-volume-wrapper .player-volume-container",
      ),
    ).not.toBeNull();
  });

  it("leaves a pan the browser already owns to scroll the popout", async () => {
    const { wrapper } = mountLargeGroup();
    const row = firstRow(await openPopout(wrapper));

    await swipeRow(row.container, false);

    expect(api.playerCommandVolumeSet).not.toHaveBeenCalled();
    // the slider must not have followed the finger on its way past either
    expect(row.level()).toBe("25");
  });

  it("still drags a popout row's volume while it can claim the gesture", async () => {
    const { wrapper } = mountLargeGroup();
    const row = firstRow(await openPopout(wrapper));

    await swipeRow(row.container, true);

    expect(api.playerCommandVolumeSet).toHaveBeenCalledWith(
      row.playerId,
      DRAGGED_VOLUME,
    );
    expect(row.level()).toBe(String(DRAGGED_VOLUME));
  });

  it("still claims the wheel where it changes volume", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    const wrapper = mount(PlayerVolume, {
      props: { player, allowWheel: true },
      global: { stubs: sliderStub },
    });

    const event = new WheelEvent("wheel", {
      deltaY: -120,
      bubbles: true,
      cancelable: true,
    });
    wrapper.find(".player-volume-container").element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(api.playerCommandVolumeUp).toHaveBeenCalledWith(player.player_id);
  });
});
