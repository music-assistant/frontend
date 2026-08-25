import { mount, shallowMount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QualityDetailsBtn from "@/components/QualityDetailsBtn.vue";
import {
  AudioQuality,
  CrossfadeMode,
  PlaybackState,
  type PlayerQueue,
  type QueueItem,
  type StreamDetails,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import {
  audioFidelity,
  audioOutputDetails,
  audioProcessingChain,
} from "../fixtures/audioProcessing";
import { audioFormat } from "../fixtures/audioFormat";
import { playerQueue } from "../fixtures/playerQueue";
import { queueItem } from "../fixtures/queueItem";
import { streamDetails } from "../fixtures/streamDetails";

const storeMock = vi.hoisted(() => ({
  activePlayer: undefined as { active_source_audio?: unknown } | undefined,
  activePlayerQueue: undefined as PlayerQueue | undefined,
  curQueueItem: undefined as QueueItem | undefined,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));
vi.mock("@/components/AudioProcessingDetails.vue", () => ({
  default: {
    props: ["crossfadeIntent"],
    template:
      '<div data-testid="audio-processing-details" :data-crossfade-intent="crossfadeIntent" />',
  },
}));

beforeEach(() => {
  i18n.global.locale.value = "en";
  storeMock.activePlayer = undefined;
  storeMock.activePlayerQueue = undefined;
  storeMock.curQueueItem = undefined;
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
      audio_processing: audioProcessingChain({
        outputs: [
          outputWithQuality(AudioQuality.LOW),
          outputWithQuality(AudioQuality.HI_RES),
        ],
      }),
    });

    const wrapper = mountButton();

    expect(wrapper.find('[data-testid="quality-popover"]').exists()).toBe(true);
    expect(
      wrapper.find('[data-testid="audio-processing-details"]').exists(),
    ).toBe(true);
    expect(wrapper.text()).toContain("LQ-HR");
    expect(wrapper.get("button").attributes("aria-label")).toBe(
      "Show audio pipeline details (LQ-HR)",
    );
  });

  it.each([
    [false, false, CrossfadeMode.DISABLED],
    [true, false, CrossfadeMode.STANDARD_CROSSFADE],
    [true, true, CrossfadeMode.SMART_CROSSFADE],
  ])(
    "passes the effective crossfade intent to the pipeline",
    (enabled, smart, expectedMode) => {
      storeMock.activePlayerQueue = makeQueue({
        ...makeStreamDetails(),
        audio_processing: audioProcessingChain(),
      });
      storeMock.activePlayerQueue.crossfade_enabled = enabled;
      storeMock.activePlayerQueue.smart_fades_active = smart;

      expect(
        mountButton()
          .get('[data-testid="audio-processing-details"]')
          .attributes("data-crossfade-intent"),
      ).toBe(expectedMode);
    },
  );

  describe("live external source, with no active queue item", () => {
    it("renders the pill from the output quality range", () => {
      storeMock.activePlayer = {
        active_source_audio: {
          input_format: audioFormat(),
          input_fidelity: audioFidelity({ quality: AudioQuality.LOW }),
          crossfade_mode: CrossfadeMode.DISABLED,
          volume_normalization_mode: VolumeNormalizationMode.DISABLED,
          outputs: [
            outputWithQuality(AudioQuality.STANDARD),
            outputWithQuality(AudioQuality.HI_RES),
          ],
        },
      };

      const wrapper = mountButton();

      expect(wrapper.find('[data-testid="quality-popover"]').exists()).toBe(
        true,
      );
      expect(wrapper.text()).toContain("SQ-HR");
    });

    it("falls back to the input fidelity before any output has reported one", () => {
      storeMock.activePlayer = {
        active_source_audio: {
          input_format: audioFormat(),
          input_fidelity: audioFidelity({ quality: AudioQuality.HI_RES }),
          crossfade_mode: CrossfadeMode.DISABLED,
          volume_normalization_mode: VolumeNormalizationMode.DISABLED,
          outputs: [],
        },
      };

      expect(mountButton().text()).toContain("HR");
    });

    it("never disables the trigger, since there is no queue to check", () => {
      storeMock.activePlayer = {
        active_source_audio: {
          input_format: audioFormat(),
          input_fidelity: audioFidelity(),
          crossfade_mode: CrossfadeMode.DISABLED,
          volume_normalization_mode: VolumeNormalizationMode.DISABLED,
          outputs: [],
        },
      };

      expect(mountButton().get("button").attributes("disabled")).toBeFalsy();
    });

    it("does not render on older servers that never send a source snapshot", () => {
      storeMock.activePlayer = {};

      expect(
        mountButton().find('[data-testid="quality-popover"]').exists(),
      ).toBe(false);
    });
  });

  it.each([
    { pill: false, side: "top" },
    { pill: true, side: "bottom" },
  ])("uses the compact popover layout on the $side side", ({ pill, side }) => {
    storeMock.activePlayerQueue = makeQueue({
      ...makeStreamDetails(),
      audio_processing: audioProcessingChain({
        outputs: [outputWithQuality(AudioQuality.STANDARD)],
      }),
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
      audio_processing: audioProcessingChain({
        outputs: [outputWithQuality(AudioQuality.STANDARD)],
      }),
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
      "Show audio pipeline details",
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

function outputWithQuality(quality: AudioQuality) {
  return audioOutputDetails({ fidelity: audioFidelity({ quality }) });
}

function makeStreamDetails(): StreamDetails {
  return streamDetails({ provider: "test", item_id: "track-1" });
}

/** Builds an active queue with the given stream details and wires it (and its
 * current item) into the store mock, mirroring the real store's derivation. */
function makeQueue(streamdetails: StreamDetails): PlayerQueue {
  const queue = playerQueue({
    // the button stays hidden for an empty queue
    items: 1,
    state: PlaybackState.PLAYING,
    current_item: queueItem({ name: "Track", duration: 180, streamdetails }),
  });
  storeMock.curQueueItem = queue.current_item ?? undefined;
  return queue;
}
