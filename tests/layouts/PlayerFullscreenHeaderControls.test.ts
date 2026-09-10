import PlayerFullscreenHeaderControls from "@/layouts/default/PlayerOSD/PlayerFullscreenHeaderControls.vue";
import AutoplayRepeatLockButton from "@/layouts/default/PlayerOSD/AutoplayRepeatLockButton.vue";
import CrossfadeIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/CrossfadeIcon.vue";
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import { CrossfadeMode, type PlayerQueue } from "@/plugins/api/interfaces";
import { shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

// Only what the crossfade and autoplay controls read is mocked; the rest of
// the header is stubbed out by shallowMount.
const queue = ref<Partial<PlayerQueue> | undefined>(undefined);
const hasActiveAudioPath = ref(false);
const autoplayApplicable = ref(false);
const repeatLocked = ref(false);
const setAutoplay = vi.fn();

vi.mock("@/plugins/api", () => ({
  default: {
    getProviderName: (providerId: string) =>
      providerId === "spotify--1" ? "Spotify" : providerId,
    queueCommandCrossfade: vi.fn(),
  },
}));
vi.mock("@/plugins/store", () => ({ store: { mobileLayout: false } }));
vi.mock("@/composables/useAudioOverlay", () => ({
  useAudioOverlay: () => ({ openOverlayDialog: vi.fn() }),
}));
vi.mock("@/composables/useActiveAudioPath", () => ({
  useActiveAudioPath: () => ({ hasActiveAudioPath }),
}));
vi.mock("@/layouts/default/PlayerOSD/useQueueModes", () => ({
  useQueueModes: () => ({
    queue,
    sources: ref([]),
    dynamicModeActive: ref(false),
    autoplayEnabled: ref(false),
    autoplayApplicable,
    repeatLocked,
    setAutoplay,
  }),
}));

// the tooltip parts are stubbed but keep rendering their slots, so the control
// and its explanation are reachable without opening a real tooltip
const slotStub = { template: "<div><slot /></div>" };

function mountControls() {
  return shallowMount(PlayerFullscreenHeaderControls, {
    global: {
      stubs: {
        TooltipProvider: slotStub,
        Tooltip: slotStub,
        TooltipTrigger: slotStub,
        TooltipContent: slotStub,
        Button: { template: "<button><slot /></button>" },
      },
    },
  });
}

function seedQueue(crossfadeMode: CrossfadeMode): void {
  queue.value = {
    queue_id: "queue-1",
    active: true,
    crossfade_enabled: true,
    smart_fades_active: true,
    current_item: {
      streamdetails: {
        provider: "spotify--1",
        audio_processing: {
          queue_processing: { crossfade_mode: crossfadeMode },
        },
      },
    },
  } as unknown as Partial<PlayerQueue>;
}

// The autoplay toggle and the crossfade toggle share the Button stub, so the
// autoplay one is picked out by its accessible name.
function findAutoplayToggle(wrapper: ReturnType<typeof mountControls>) {
  return wrapper
    .findAll("button")
    .find((button) => button.attributes("aria-label") === "Autoplay");
}

describe("PlayerFullscreenHeaderControls", () => {
  beforeEach(() => {
    queue.value = undefined;
    hasActiveAudioPath.value = false;
    autoplayApplicable.value = false;
    repeatLocked.value = false;
    setAutoplay.mockClear();
  });

  it("does not animate a fade the source applied", () => {
    seedQueue(CrossfadeMode.SOURCE);

    const icon = mountControls().findComponent(CrossfadeIcon);

    expect(icon.props("smart")).toBe(false);
  });

  it("does not animate a standard fade", () => {
    seedQueue(CrossfadeMode.STANDARD_CROSSFADE);
    queue.value!.smart_fades_active = false;

    expect(mountControls().findComponent(CrossfadeIcon).props("smart")).toBe(
      false,
    );
  });

  it("animates our own smart fade", () => {
    seedQueue(CrossfadeMode.SMART_CROSSFADE);

    expect(mountControls().findComponent(CrossfadeIcon).props("smart")).toBe(
      true,
    );
  });

  it("mirrors the source fade details in the tooltip", () => {
    seedQueue(CrossfadeMode.SOURCE);

    const text = mountControls().text();

    expect(text).toContain("Crossfade");
    expect(text).toContain("Applied by Spotify");
    expect(text).not.toContain("Disable crossfade");
  });

  it("shows the quality pill when there is an active audio path", () => {
    hasActiveAudioPath.value = true;

    expect(mountControls().findComponent(QualityDetailsBtn).exists()).toBe(
      true,
    );
  });

  it("hides the quality pill without an active audio path", () => {
    hasActiveAudioPath.value = false;

    expect(mountControls().findComponent(QualityDetailsBtn).exists()).toBe(
      false,
    );
  });

  it("replaces the autoplay toggle with the repeat-lock explanation while repeat is on", () => {
    seedQueue(CrossfadeMode.SOURCE);
    autoplayApplicable.value = true;
    repeatLocked.value = true;

    const wrapper = mountControls();
    const lock = wrapper.findComponent(AutoplayRepeatLockButton);

    expect(lock.exists()).toBe(true);
    expect(lock.props("description")).toBe(
      "Autoplay has been automatically turned off because repeat is on",
    );
    expect(findAutoplayToggle(wrapper)).toBeUndefined();
    expect(setAutoplay).not.toHaveBeenCalled();
  });

  it("keeps the direct autoplay toggle while repeat is off", async () => {
    seedQueue(CrossfadeMode.SOURCE);
    autoplayApplicable.value = true;

    const wrapper = mountControls();
    const toggle = findAutoplayToggle(wrapper);

    expect(wrapper.findComponent(AutoplayRepeatLockButton).exists()).toBe(
      false,
    );
    expect(toggle).toBeDefined();

    await toggle!.trigger("click");

    expect(setAutoplay).toHaveBeenCalledExactlyOnceWith(true);
  });
});
