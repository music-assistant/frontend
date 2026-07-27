import { mount, shallowMount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import {
  AudioQuality,
  ContentType,
  MediaType,
  PlaybackState,
  type PlayerQueue,
  RepeatMode,
  type StreamDetails,
} from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";

const storeMock = vi.hoisted(() => ({
  activePlayerQueue: undefined as PlayerQueue | undefined,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));
vi.mock("@/components/AudioProcessingDetails.vue", () => ({
  default: {
    template: '<div data-testid="audio-processing-details" />',
  },
}));

beforeEach(() => {
  i18n.global.locale.value = "en";
  storeMock.activePlayerQueue = undefined;
  document.body.innerHTML = "";
});

describe("QualityDetailsBtn", () => {
  it.each([
    ["absent", undefined],
    ["pending", null],
  ])("does not render without a populated %s chain", (_label, chain) => {
    storeMock.activePlayerQueue = makeQueue({
      ...makeStreamDetails(),
      ...(chain === null ? { audio_processing: null } : {}),
    });

    const wrapper = mountButton();

    expect(wrapper.find('[data-testid="quality-popover"]').exists()).toBe(
      false,
    );
    expect(
      wrapper.find('[data-testid="audio-processing-details"]').exists(),
    ).toBe(false);
  });

  it("renders embedded details and the authoritative quality range", () => {
    storeMock.activePlayerQueue = makeQueue({
      ...makeStreamDetails(),
      audio_processing: {
        outputs: [
          { fidelity: { quality: AudioQuality.LOW } },
          { fidelity: { quality: AudioQuality.HI_RES } },
        ],
      },
    });

    const wrapper = mountButton();

    expect(wrapper.find('[data-testid="quality-popover"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="audio-processing-details"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain("LQ-HR");
    expect(wrapper.get("button").attributes("aria-label")).toBe(
      "Show audio chain details (LQ-HR)",
    );
  });

  it.each([
    { pill: false, side: "top" },
    { pill: true, side: "bottom" },
  ])("uses the compact popover layout on the $side side", ({ pill, side }) => {
    storeMock.activePlayerQueue = makeQueue({
      ...makeStreamDetails(),
      audio_processing: {
        outputs: [{ fidelity: { quality: AudioQuality.STANDARD } }],
      },
    });

    const wrapper = mountButton({ pill });
    const content = wrapper.find(
      '[data-testid="audio-processing-popover-content"]',
    );

    expect(content.classes()).toEqual(
      expect.arrayContaining(["audio-processing-popover", "overflow-y-auto"]),
    );
    expect(content.attributes("side")).toBe(side);
    expect(content.attributes("collision-padding")).toBe("8");
  });

  it("moves focus into the audio-chain popover when opened", async () => {
    storeMock.activePlayerQueue = makeQueue({
      ...makeStreamDetails(),
      audio_processing: {
        outputs: [{ fidelity: { quality: AudioQuality.STANDARD } }],
      },
    });

    const wrapper = mount(QualityDetailsBtn, {
      attachTo: document.body,
    });
    await wrapper.get("button").trigger("click");
    await nextTick();

    const content = document.body.querySelector<HTMLElement>(
      '[data-testid="audio-processing-popover-content"]',
    );
    expect(content?.getAttribute("aria-label")).toBe(
      "Show audio chain details",
    );
    expect(content?.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.classList).toContain(
      "audio-processing-popover-focus-target",
    );
    wrapper.unmount();
  });
});

function mountButton(props: { pill?: boolean } = {}) {
  return shallowMount(QualityDetailsBtn, {
    props,
    global: {
      stubs: {
        AudioProcessingDetails: false,
        Button: { template: "<button><slot /></button>" },
        Popover: {
          template: '<div data-testid="quality-popover"><slot /></div>',
        },
        PopoverContent: { template: "<div><slot /></div>" },
        PopoverTrigger: { template: "<div><slot /></div>" },
      },
    },
  });
}

function makeStreamDetails(): StreamDetails {
  return {
    provider: "test",
    item_id: "track-1",
    audio_format: {
      content_type: ContentType.FLAC,
      codec_type: ContentType.FLAC,
      sample_rate: 44100,
      bit_depth: 16,
      channels: 2,
      output_format_str: "",
      bit_rate: 0,
    },
    media_type: MediaType.TRACK,
  };
}

function makeQueue(streamdetails: StreamDetails): PlayerQueue {
  return {
    queue_id: "queue-1",
    active: true,
    display_name: "Queue",
    available: true,
    items: 1,
    shuffle_enabled: false,
    smart_shuffle_active: false,
    autoplay_enabled: false,
    repeat_mode: RepeatMode.OFF,
    crossfade_enabled: false,
    smart_fades_active: false,
    overlay_enabled: false,
    overlay_volume: 100,
    elapsed_time: 0,
    elapsed_time_last_updated: 0,
    state: PlaybackState.PLAYING,
    current_item: {
      queue_id: "queue-1",
      queue_item_id: "item-1",
      name: "Track",
      duration: 180,
      sort_index: 0,
      streamdetails,
      available: true,
    },
    sources: [],
    enqueued_media_items: [],
    is_dynamic: false,
  };
}
