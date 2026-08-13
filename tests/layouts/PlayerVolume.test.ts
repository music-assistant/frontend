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
      ><div data-slot="slider-track" /></div>
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

  // The popout is teleported out to the body, so the padding the fullscreen
  // player keeps clear of the cutout never reaches it and it has to hold the
  // margin off the safe edges itself. Each side carries its own inset, so a
  // mix-up cannot pass.
  describe("with a cutout on both sides", () => {
    const INSET_LEFT = 77;
    const INSET_RIGHT = 44;
    const VIEWPORT_WIDTH = 1000;
    const POPOUT_WIDTH = 300;
    const MARGIN = 8;

    const originalInnerWidth = Object.getOwnPropertyDescriptor(
      window,
      "innerWidth",
    );

    function placeSlider(left: number, width: number) {
      vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
        top: SLIDER_BOTTOM - 40,
        bottom: SLIDER_BOTTOM,
        left,
        right: left + width,
        width,
        height: 40,
      } as DOMRect);
    }

    beforeEach(() => {
      Object.defineProperty(window, "innerWidth", {
        value: VIEWPORT_WIDTH,
        writable: true,
        configurable: true,
      });
      document.documentElement.style.setProperty(
        "--device-inset-left",
        `${INSET_LEFT}px`,
      );
      document.documentElement.style.setProperty(
        "--device-inset-right",
        `${INSET_RIGHT}px`,
      );
    });

    afterEach(() => {
      document.documentElement.removeAttribute("style");
      if (originalInnerWidth) {
        Object.defineProperty(window, "innerWidth", originalInnerWidth);
      }
    });

    it("stops the popout short of the cutout at the end of the screen", async () => {
      // far enough over that centring it on the slider would run past the end
      placeSlider(850, 140);
      const { wrapper } = mountLargeGroup();

      const popout = await openPopout(wrapper);

      expect(popout.style.left).toBe(
        `${VIEWPORT_WIDTH - MARGIN - INSET_RIGHT - POPOUT_WIDTH}px`,
      );
    });

    it("stops it short of the one at the start of the screen", async () => {
      placeSlider(20, 140);
      const { wrapper } = mountLargeGroup();

      const popout = await openPopout(wrapper);

      expect(popout.style.left).toBe(`${MARGIN + INSET_LEFT}px`);
    });

    it("holds the margin off both safe edges on mobile", async () => {
      store.mobileLayout = true;
      placeSlider(100, 200);
      const { wrapper } = mountLargeGroup();

      const popout = await openPopout(wrapper);

      expect(popout.style.left).toBe(`${MARGIN + INSET_LEFT}px`);
      expect(popout.style.right).toBe(`${MARGIN + INSET_RIGHT}px`);
    });
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

describe("PlayerVolume touch expansion", () => {
  let wrapper: ReturnType<typeof mountExpandable> | undefined;

  function mountExpandable(
    player: Player,
    props: Record<string, unknown> = {},
  ) {
    return mount(PlayerVolume, {
      props: { player, expandOnTouch: true, ...props },
      global: {
        stubs: sliderStub,
        mocks: { $t: (key: string) => key },
      },
    });
  }

  function mountExpandableGroup() {
    const child = createPlayer({ player_id: "child", name: "Office" });
    const parent = createPlayer({ group_members: ["parent", "child"] });
    api.players = { parent, child };
    return mountExpandable(parent, {
      preferGroupVolume: true,
      enablePopout: false,
      requestExpandOnGroupTap: true,
    });
  }

  function touchStart(target: ReturnType<typeof mountExpandable>) {
    return target
      .find(".player-volume-container")
      .trigger("touchstart", { touches: [{ clientX: 50, clientY: 10 }] });
  }

  function touchEnd(target: ReturnType<typeof mountExpandable>) {
    return target
      .find(".player-volume-container")
      .trigger("touchend", { changedTouches: [{ clientX: 50, clientY: 10 }] });
  }

  // past the 8px the slider needs to call a touch a drag rather than a tap
  function touchDrag(target: ReturnType<typeof mountExpandable>) {
    return target
      .find(".player-volume-container")
      .trigger("touchmove", { touches: [{ clientX: 90, clientY: 10 }] });
  }

  function touchScroll(target: ReturnType<typeof mountExpandable>) {
    return target
      .find(".player-volume-container")
      .trigger("touchmove", { touches: [{ clientX: 51, clientY: 60 }] });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    api.players = {};
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("leaves the other volume sliders without step buttons", () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mount(PlayerVolume, {
      props: { player },
      global: { stubs: sliderStub },
    });

    expect(wrapper.findAll(".volume-step-btn")).toHaveLength(0);
    expect(wrapper.find(".volume-icon-btn").classes()).not.toContain(
      "is-hidden",
    );
  });

  it("swaps the mute button and level readout for step buttons on touch", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);
    const container = wrapper.find(".player-volume-container");

    expect(container.classes()).toContain("expandable");
    expect(container.classes()).not.toContain("expanded");
    expect(wrapper.find(".volume-icon-btn").classes()).not.toContain(
      "is-hidden",
    );
    expect(
      wrapper.find(".volume-prepend .volume-step-btn").classes(),
    ).toContain("is-hidden");

    await touchStart(wrapper);

    expect(container.classes()).toContain("expanded");
    expect(wrapper.find(".volume-icon-btn").classes()).toContain("is-hidden");
    expect(wrapper.find(".volume-level-text").classes()).toContain("is-hidden");
    expect(
      wrapper.find(".volume-prepend .volume-step-btn").classes(),
    ).not.toContain("is-hidden");
    expect(
      wrapper.find(".volume-append .volume-step-btn").classes(),
    ).not.toContain("is-hidden");
  });

  it("fills both slots in either state, so the track keeps its width", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);

    // the step buttons cross-fade over the slots the mute button and the level
    // readout already occupy: nothing enters or leaves the row, so the thumb
    // cannot jump sideways under a finger that is mid-drag
    const slotContents = () => [
      wrapper!.findAll(".volume-prepend > *").length,
      wrapper!.findAll(".volume-append > *").length,
    ];
    const atRest = slotContents();

    await touchStart(wrapper);

    expect(atRest).toEqual([2, 2]);
    expect(slotContents()).toEqual(atRest);
  });

  it("steps the volume from the buttons without reading them as track taps", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);
    await touchStart(wrapper);

    await wrapper.find(".volume-prepend .volume-step-btn").trigger("click");
    expect(api.playerCommandVolumeDown).toHaveBeenCalledWith(player.player_id);

    await wrapper.find(".volume-append .volume-step-btn").trigger("click");
    expect(api.playerCommandVolumeUp).toHaveBeenCalledWith(player.player_id);

    expect(api.playerCommandVolumeSet).not.toHaveBeenCalled();
  });

  it("returns to the resting slider two seconds after the last interaction", async () => {
    vi.useFakeTimers();
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);
    const container = wrapper.find(".player-volume-container");

    await touchStart(wrapper);
    await touchEnd(wrapper);
    expect(container.classes()).toContain("expanded");

    await vi.advanceTimersByTimeAsync(1999);
    await nextTick();
    expect(container.classes()).toContain("expanded");

    // a step tap buys another full window, so a second press never lands on a
    // slider that is already collapsing
    await wrapper.find(".volume-append .volume-step-btn").trigger("click");
    await vi.advanceTimersByTimeAsync(1999);
    await nextTick();
    expect(container.classes()).toContain("expanded");

    await vi.advanceTimersByTimeAsync(1);
    await nextTick();
    expect(container.classes()).not.toContain("expanded");
  });

  it("keeps the mute button reachable while the slider is muted", async () => {
    const player = createPlayer({ volume_muted: true });
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);
    const container = wrapper.find(".player-volume-container");

    await touchStart(wrapper);

    expect(container.classes()).not.toContain("expanded");
    expect(wrapper.find(".volume-icon-btn").classes()).not.toContain(
      "is-hidden",
    );
  });

  it("leaves the slider at its resting size for a mouse", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);
    const container = wrapper.find(".player-volume-container");
    const slider = wrapper.find('[data-slot="slider"]');

    // a pointer hits the resting rail accurately enough, so neither a click nor
    // a drag with one has any reason to grow it
    await slider.trigger("pointerdown", { clientX: 50, pointerType: "mouse" });
    expect(container.classes()).not.toContain("expanded");

    await slider.trigger("pointermove", { clientX: 90, pointerType: "mouse" });
    await slider.trigger("pointerup", { clientX: 90, pointerType: "mouse" });

    expect(container.classes()).not.toContain("expanded");
    expect(document.querySelector(".volume-bubble")).toBeNull();
  });

  it("leaves a group slider alone until the touch becomes a drag", async () => {
    wrapper = mountExpandableGroup();
    const container = wrapper.find(".player-volume-container");

    // a tap on a group slider opens its own volume controls, so the buttons
    // must not swap in under the finger that is about to lift
    await touchStart(wrapper);
    expect(container.classes()).not.toContain("expanded");

    await touchDrag(wrapper);
    expect(container.classes()).toContain("expanded");
  });

  it("still opens the group controls from a tap that never drags", async () => {
    wrapper = mountExpandableGroup();
    const container = wrapper.find(".player-volume-container");

    await touchStart(wrapper);
    await touchEnd(wrapper);

    expect(wrapper.emitted("toggle-group-expansion")).toHaveLength(1);
    expect(container.classes()).not.toContain("expanded");
  });

  it("steps the group volume when the bar is showing a group", async () => {
    wrapper = mountExpandableGroup();
    await touchStart(wrapper);
    await touchDrag(wrapper);

    await wrapper.find(".volume-prepend .volume-step-btn").trigger("click");

    expect(api.playerCommandGroupVolumeDown).toHaveBeenCalledWith("parent");
    expect(api.playerCommandVolumeDown).not.toHaveBeenCalled();
  });

  it("drops the step buttons as soon as the touch turns into a scroll", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);
    const container = wrapper.find(".player-volume-container");

    await touchStart(wrapper);
    expect(container.classes()).toContain("expanded");

    // the panels these rows sit in scroll, so a swipe must not leave a list of
    // them fattened in its wake
    await touchScroll(wrapper);

    expect(container.classes()).not.toContain("expanded");
  });

  it("keeps a step tap from being read as a drag on the track", async () => {
    const player = createPlayer({ volume_level: 20 });
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);

    // a tap on the track, so the slider has a start position on record
    await touchStart(wrapper);
    await touchEnd(wrapper);

    // tapping a step button far from that position must not be measured
    // against it: the slot swallows the whole sequence, moves included
    const plus = wrapper.find(".volume-append .volume-step-btn");
    await plus.trigger("touchstart", {
      touches: [{ clientX: 300, clientY: 10 }],
    });
    await plus.trigger("touchmove", {
      touches: [{ clientX: 302, clientY: 11 }],
    });
    await plus.trigger("touchend", {
      changedTouches: [{ clientX: 302, clientY: 11 }],
    });

    // a latched drag would block the server sync for good, because the touch
    // that started it never reaches the handler that ends it
    await wrapper.setProps({ player: { ...player, volume_level: 55 } });
    await nextTick();

    expect(wrapper.find(".volume-level-text").text()).toBe("55");
  });

  it("steps the volume from a click, so a keyboard can reach the buttons", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);
    await touchStart(wrapper);

    await wrapper.find(".volume-append .volume-step-btn").trigger("click");
    await wrapper.find(".volume-prepend .volume-step-btn").trigger("click");

    expect(api.playerCommandVolumeUp).toHaveBeenCalledWith(player.player_id);
    expect(api.playerCommandVolumeDown).toHaveBeenCalledWith(player.player_id);
  });

  it("takes the hidden half of each slot out of the tab order", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);

    const inert = (selector: string) =>
      wrapper!.find(selector).attributes("inert") !== undefined;

    expect(inert(".volume-prepend .volume-step-btn")).toBe(true);
    expect(inert(".volume-icon-btn")).toBe(false);

    await touchStart(wrapper);

    // both halves stay mounted to hold the slot's width, so the one that is
    // faded out has to leave the a11y tree rather than just the screen
    expect(inert(".volume-prepend .volume-step-btn")).toBe(false);
    expect(inert(".volume-icon-btn")).toBe(true);
    expect(inert(".volume-level-text")).toBe(true);
  });

  it("collapses on a touch that ends after the player goes unavailable", async () => {
    vi.useFakeTimers();
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);
    const container = wrapper.find(".player-volume-container");

    await touchStart(wrapper);
    expect(container.classes()).toContain("expanded");

    // it would otherwise stay latched and re-expand on its own once the player
    // came back, with no touch behind it
    api.players[player.player_id]!.available = false;
    await wrapper.setProps({ player: { ...player, available: false } });
    await touchEnd(wrapper);
    await vi.advanceTimersByTimeAsync(2000);
    await wrapper.setProps({ player: { ...player, available: true } });
    await nextTick();

    expect(container.classes()).not.toContain("expanded");
  });

  it("shows the volume readout over the thumb while expanded", async () => {
    const player = createPlayer({ volume_level: 40 });
    api.players = { [player.player_id]: player };
    wrapper = mountExpandable(player);

    expect(document.querySelector(".volume-bubble")).toBeNull();

    await touchStart(wrapper);
    await nextTick();

    const bubble = document.querySelector<HTMLElement>(".volume-bubble");
    expect(bubble?.textContent?.trim()).toBe("40");
    // anchored to the thumb's position along the track rather than to the row
    expect(bubble?.style.left).not.toBe("");
    expect(bubble?.style.bottom).not.toBe("");
  });
});
