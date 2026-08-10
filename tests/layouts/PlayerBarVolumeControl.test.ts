import PlayerBarVolumeControl from "@/layouts/default/PlayerOSD/PlayerBarVolumeControl.vue";
import { api } from "@/plugins/api";
import {
  IdentifierType,
  PlaybackState,
  type Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { h, inject, provide, type InjectionKey, type SetupContext } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({
    players: {} as Record<string, Player>,
    playerCommandGroupVolumeDown: vi.fn(),
    playerCommandGroupVolumeUp: vi.fn(),
    playerCommandVolumeDown: vi.fn(),
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
  getPlayerName: (player: Player) => player.name,
  getVolumeIconComponent: () => ({
    template: "<span class='volume-icon' />",
  }),
}));

const popoverToggleKey: InjectionKey<() => void> = Symbol();
const PopoverStub = {
  props: {
    open: {
      type: Boolean,
      required: true,
    },
  },
  emits: ["update:open"],
  setup(
    props: Readonly<{ open?: boolean }>,
    { emit, slots }: SetupContext<["update:open"]>,
  ) {
    provide(popoverToggleKey, () => emit("update:open", !props.open));
    return () =>
      h(
        "div",
        {
          class: "popover",
          "data-open": String(props.open),
        },
        slots.default?.(),
      );
  },
};
const PopoverTriggerStub = {
  setup(_: unknown, { slots }: SetupContext) {
    const toggle = inject(popoverToggleKey);
    if (!toggle) throw new Error("PopoverTrigger must be inside Popover");
    return () => h("div", { onClick: toggle }, slots.default?.());
  },
};
const passthroughStub = {
  template: "<div><slot /></div>",
};
const ButtonStub = {
  inheritAttrs: false,
  props: ["disabled"],
  template: `
    <button v-bind="$attrs" :disabled="disabled">
      <slot />
    </button>
  `,
};
const PlayerVolumeStub = {
  props: ["player"],
  template: `<div class="player-volume" :data-player-id="player.player_id" />`,
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

function mountControl(player: Player) {
  return mount(PlayerBarVolumeControl, {
    props: { player },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        Button: ButtonStub,
        PlayerIcon: passthroughStub,
        PlayerVolume: PlayerVolumeStub,
        Popover: PopoverStub,
        PopoverAnchor: passthroughStub,
        PopoverContent: passthroughStub,
        PopoverTrigger: PopoverTriggerStub,
        Separator: passthroughStub,
        Teleport: true,
      },
    },
  });
}

describe("PlayerBarVolumeControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    api.players = {};
  });

  it("does not open on hover", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    const wrapper = mountControl(player);
    const trigger = wrapper.get("[data-player-volume-trigger]");

    await trigger.trigger("pointerenter", { pointerType: "mouse" });

    expect(wrapper.get(".popover").attributes("data-open")).toBe("false");
  });

  it("toggles the active popover on click", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    const wrapper = mountControl(player);
    const trigger = wrapper.get("[data-player-volume-trigger]");

    await trigger.trigger("click");

    expect(wrapper.get(".popover").attributes("data-open")).toBe("true");
    expect(trigger.attributes("data-active")).toBe("true");
    expect(wrapper.find(".player-volume-backdrop").exists()).toBe(true);

    await wrapper.get(".player-volume-backdrop").trigger("click");
    expect(wrapper.get(".popover").attributes("data-open")).toBe("false");
  });

  it("suppresses hover color after clicking the popover closed", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    const wrapper = mountControl(player);
    const trigger = wrapper.get("[data-player-volume-trigger]");

    await trigger.trigger("click");
    await trigger.trigger("click");

    expect(trigger.attributes("data-active")).toBe("false");
    expect(trigger.attributes("data-suppress-hover")).toBe("true");

    await trigger.trigger("pointerleave");
    expect(trigger.attributes("data-suppress-hover")).toBe("false");
  });

  it("shows child controls and the group volume", () => {
    const child = createPlayer({
      player_id: "child",
      name: "Office",
    });
    const parent = createPlayer({
      group_members: ["parent", child.player_id],
      group_volume: 70,
    });
    api.players = {
      [parent.player_id]: parent,
      [child.player_id]: child,
    };

    const wrapper = mountControl(parent);

    expect(
      wrapper
        .findAll(".player-volume")
        .map((volume) => volume.attributes("data-player-id")),
    ).toEqual(["parent", "child", "parent"]);
    expect(
      wrapper.get("[data-player-volume-trigger]").attributes("aria-label"),
    ).toBe("audio_overlay_volume: 70%");
  });

  it("keeps every volume label centered without clipping", () => {
    const player = createPlayer({ volume_level: 5 });
    api.players = { [player.player_id]: player };

    const wrapper = mountControl(player);
    const label = wrapper.get(".player-bar-action-label");

    expect(label.classes()).toContain("w-10");
    expect(label.classes()).toContain("overflow-visible");
    expect(wrapper.get(".volume-icon").attributes("style")).toContain(
      "translateX(1.5px)",
    );
  });

  it("adjusts a standalone player with the mouse wheel", async () => {
    const player = createPlayer();
    api.players = { [player.player_id]: player };
    const wrapper = mountControl(player);
    const trigger = wrapper.get("[data-player-volume-trigger]");

    await trigger.trigger("wheel", { deltaY: -1 });
    await trigger.trigger("wheel", { deltaY: 1 });

    expect(api.playerCommandVolumeUp).toHaveBeenCalledWith(player.player_id);
    expect(api.playerCommandVolumeDown).toHaveBeenCalledWith(player.player_id);
  });

  it("adjusts grouped volume with the mouse wheel", async () => {
    const child = createPlayer({ player_id: "child" });
    const player = createPlayer({
      group_members: ["parent", child.player_id],
    });
    api.players = {
      [player.player_id]: player,
      [child.player_id]: child,
    };
    const wrapper = mountControl(player);

    await wrapper
      .get("[data-player-volume-trigger]")
      .trigger("wheel", { deltaY: -1 });

    expect(api.playerCommandGroupVolumeUp).toHaveBeenCalledWith(
      player.player_id,
    );
    expect(api.playerCommandVolumeUp).not.toHaveBeenCalled();
  });
});
