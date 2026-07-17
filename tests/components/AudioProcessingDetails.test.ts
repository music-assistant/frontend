import { mount } from "@vue/test-utils";
import { nextTick, type Ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AudioProcessingDetails from "@/components/AudioProcessingDetails.vue";
import { i18n } from "@/plugins/i18n";
import {
  AudioChannel,
  AudioNormalizationMeasurementSource,
  type AudioFormat,
  type AudioProcessingChain,
  AudioQuality,
  ContentType,
  CrossfadeMode,
  DSPFilterType,
  DSPState,
  MediaType,
  type StreamDetails,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";

const apiMock = vi.hoisted(() => ({
  getProviderName: vi.fn(() => "Test provider"),
  players: {} as Record<string, { name: string }>,
}));
const presetRegistryMock = vi.hoisted(() => ({
  names: undefined as Ref<Map<string, string>> | undefined,
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  api: apiMock,
}));
vi.mock("@/composables/useDSPPresets", async () => {
  const { ref } = await import("vue");
  presetRegistryMock.names = ref(new Map<string, string>());
  return {
    useDSPPresets: () => ({
      getPresetName: (presetId: string | null | undefined) =>
        presetId ? getPresetNames().value.get(presetId) : undefined,
    }),
  };
});

beforeEach(() => {
  i18n.global.locale.value = "en";
  apiMock.players = {
    "player-1": { name: "Kitchen" },
    "player-2": { name: "Office" },
  };
  getPresetNames().value = new Map([["preset-1", "Living room"]]);
});

describe("AudioProcessingDetails", () => {
  it("renders the embedded processing model and server-grouped outputs", () => {
    const wrapper = mountDetails(makeFullChain());

    expect(wrapper.findAll('[data-testid="audio-output-path"]')).toHaveLength(
      1,
    );
    expect(
      wrapper
        .find('[data-testid="audio-output-path"]')
        .attributes("data-player-ids"),
    ).toBe("player-1,player-2");
    expect(
      wrapper
        .findAll('[data-stage="destination"]')
        .map((destination) => destination.text()),
    ).toEqual(["Kitchen", "Office"]);

    const stageKeys = wrapper
      .findAll("[data-stage]")
      .map((stage) => stage.attributes("data-stage"));
    expect(stageKeys).toEqual(
      expect.arrayContaining([
        "provider",
        "source-format",
        "pcm-format",
        "normalization",
        "playback-speed",
        "crossfade",
        "overlay",
        "dsp-state-0",
        "dsp-preset-0",
        "dsp-input-gain-0",
        "dsp-filter-0-0",
        "dsp-filter-0-1",
        "dsp-filter-0-2",
        "dsp-output-gain-0",
        "output-limiter-0",
        "source-channel-0",
        "output-format-0",
        "bit-perfect-0",
      ]),
    );

    const text = wrapper.text();
    expect(text).toContain("Provider: Test provider");
    expect(text).toContain("32-bit float PCM");
    expect(text).toContain("Playback speed: 1.25x");
    expect(text).toContain("Crossfade: Smart");
    expect(text).toContain("Audio overlay active");
    expect(text).toContain("DSP preset: Living room");
    expect(text).toContain("Gain");
    expect(text).toContain("Balance");
    expect(text).toContain("Source channel: Left");
    expect(text).toContain("Output Limiter");
    expect(text).toContain("Lossless");
    expect(text).toContain("Bit-perfect output");
  });

  it("updates a resolved preset name reactively", async () => {
    const wrapper = mountDetails(makeFullChain());
    expect(wrapper.text()).toContain("DSP preset: Living room");

    getPresetNames().value = new Map([["preset-1", "Cinema"]]);
    await nextTick();

    expect(wrapper.text()).toContain("DSP preset: Cinema");
    expect(wrapper.text()).not.toContain("Living room");
  });

  it("uses Custom for an unresolved preset without exposing its ID", () => {
    getPresetNames().value = new Map();
    const wrapper = mountDetails(makeFullChain());

    expect(wrapper.text()).toContain("DSP preset: Custom");
    expect(wrapper.text()).not.toContain("preset-1");
  });

  it("renders future enum values as safe unknown states", () => {
    const wrapper = mountDetails({
      input_fidelity: { quality: "future" as AudioQuality },
      queue_processing: {
        crossfade_mode: "future" as CrossfadeMode,
      },
      outputs: [
        {
          player_ids: ["player-1"],
          dsp: { state: "future" as DSPState },
          source_channel: "future" as AudioChannel,
          fidelity: { quality: "future" as AudioQuality },
        },
      ],
    });

    const text = wrapper.text();
    expect(text).toContain("Quality unknown");
    expect(text).toContain("Crossfade: Unknown");
    expect(text).toContain("DSP state unknown");
    expect(text).toContain("Source channel: Unknown");
    expect(text).not.toContain("future");
  });
});

function mountDetails(chain: AudioProcessingChain) {
  return mount(AudioProcessingDetails, {
    props: {
      chain,
      streamDetails: makeStreamDetails(),
    },
    global: {
      stubs: {
        Tooltip: { template: "<div><slot /></div>" },
        TooltipContent: { template: "<div><slot /></div>" },
        TooltipProvider: { template: "<div><slot /></div>" },
        TooltipTrigger: { template: "<div><slot /></div>" },
      },
    },
  });
}

function getPresetNames(): Ref<Map<string, string>> {
  if (!presetRegistryMock.names) {
    throw new Error("Preset registry mock was not initialized");
  }
  return presetRegistryMock.names;
}

function makeFormat(overrides: Partial<AudioFormat> = {}): AudioFormat {
  return {
    content_type: ContentType.FLAC,
    codec_type: ContentType.FLAC,
    sample_rate: 96000,
    bit_depth: 24,
    channels: 2,
    output_format_str: "",
    bit_rate: 0,
    ...overrides,
  };
}

function makeStreamDetails(): StreamDetails {
  return {
    provider: "test",
    item_id: "track-1",
    audio_format: makeFormat(),
    media_type: MediaType.TRACK,
  };
}

function makeFullChain(): AudioProcessingChain {
  const floatPcm = makeFormat({
    content_type: ContentType.PCM_F32LE,
    codec_type: ContentType.PCM_F32LE,
    sample_rate: 48000,
    bit_depth: 32,
  });
  return {
    input_fidelity: { quality: AudioQuality.HI_RES },
    queue_processing: {
      pcm_format: floatPcm,
      normalization: {
        mode: VolumeNormalizationMode.DYNAMIC,
        measurement_source: AudioNormalizationMeasurementSource.LIVE,
        target_lufs: -14,
        measured_lufs: -12.5,
        applied_gain_db: -1.5,
      },
      playback_speed: 1.25,
      crossfade_mode: CrossfadeMode.SMART_CROSSFADE,
      overlay_active: true,
    },
    outputs: [
      {
        player_ids: ["player-1", "player-2"],
        dsp: {
          state: DSPState.ENABLED,
          preset_id: "preset-1",
          input_gain: -1,
          filters: [
            {
              type: DSPFilterType.TONE_CONTROL,
              enabled: true,
              bass_level: 1,
              mid_level: 0,
              treble_level: -1,
            },
            {
              type: DSPFilterType.GAIN,
              enabled: true,
              gain: 2,
            },
            {
              type: DSPFilterType.BALANCE,
              enabled: true,
              balance: -25,
            },
          ],
          output_gain: 2,
          output_limiter: true,
        },
        source_channel: AudioChannel.FL,
        output_format: makeFormat({
          sample_rate: 48000,
          bit_depth: 16,
        }),
        fidelity: {
          quality: AudioQuality.LOSSLESS,
          bit_perfect: true,
        },
      },
    ],
  };
}
