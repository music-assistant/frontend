import PlayerFullscreenHeaderControls from "@/layouts/default/PlayerOSD/PlayerFullscreenHeaderControls.vue";
import CrossfadeIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/CrossfadeIcon.vue";
import { CrossfadeMode, type PlayerQueue } from "@/plugins/api/interfaces";
import { shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

// Only what the crossfade control reads is mocked; the rest of the header is
// stubbed out by shallowMount.
const queue = ref<Partial<PlayerQueue> | undefined>(undefined);

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
vi.mock("@/layouts/default/PlayerOSD/useQueueModes", () => ({
  useQueueModes: () => ({
    queue,
    sources: ref([]),
    dynamicModeActive: ref(false),
    autoplayEnabled: ref(false),
    autoplayApplicable: ref(false),
    setAutoplay: vi.fn(),
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

describe("PlayerFullscreenHeaderControls", () => {
  beforeEach(() => {
    queue.value = undefined;
  });

  it("does not animate a fade the source applied", () => {
    // smart_fades_active only reflects the queue setting: none of our timing is
    // applied here, so the twinkle would claim a fade we did not render
    seedQueue(CrossfadeMode.SOURCE);

    const icon = mountControls().findComponent(CrossfadeIcon);

    expect(icon.props("active")).toBe(true);
    expect(icon.props("smart")).toBe(false);
  });

  it("animates our own smart fade", () => {
    seedQueue(CrossfadeMode.SMART_CROSSFADE);

    expect(mountControls().findComponent(CrossfadeIcon).props("smart")).toBe(
      true,
    );
  });

  it("names the service that applies the fade", () => {
    seedQueue(CrossfadeMode.SOURCE);

    const text = mountControls().text();

    expect(text).toContain("Spotify applies the fade to this track");
    expect(text).not.toContain("The fade timing is chosen automatically");
  });
});
