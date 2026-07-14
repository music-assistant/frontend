import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AudioProcessingDetails from "@/components/AudioProcessingDetails.vue";
import { i18n } from "@/plugins/i18n";
import {
  AudioChannelMode,
  AudioCrossfadeState,
  AudioDitheringMethod,
  type AudioFormat,
  AudioNormalizationMeasurementSource,
  type AudioProcessingChain,
  AudioProcessingState,
  AudioQuality,
  AudioResamplingMethod,
  ContentType,
  CrossfadeMode,
  DSPFilterType,
  DSPState,
  MediaType,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";

const apiMock = vi.hoisted(() => ({
  players: {} as Record<string, { name: string }>,
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  api: apiMock,
}));

beforeEach(() => {
  i18n.global.locale.value = "en";
  apiMock.players = {
    "player-1": { name: "Kitchen" },
    "player-2": { name: "Office" },
  };
});

describe("AudioProcessingDetails", () => {
  it("renders server-grouped output paths and the effective processing stages", () => {
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
        "source-format",
        "server-input-format",
        "shared-input-format",
        "normalization",
        "tempo",
        "crossfade",
        "overlay",
        "shared-output-format",
        "dsp-state-0",
        "channels-0",
        "limiter-0",
        "resampling-0",
        "dithering-0",
        "handoff-format-0",
        "output-format-0",
        "bit-perfect-0",
      ]),
    );
    expect(stageKeys.indexOf("handoff-format-0")).toBeLessThan(
      stageKeys.indexOf("output-format-0"),
    );

    const text = wrapper.text();
    expect(text).toContain("32-bit float PCM");
    expect(text).toContain("Playback speed: 1.25x");
    expect(text).toContain("Crossfade: Smart · Applied");
    expect(text).toContain("Overlay: Rain at 35%");
    expect(text).toContain("DSP active");
    expect(text).toContain("Channel routing: Mono");
    expect(text).toContain("Limiter enabled (-1 dBFS)");
    expect(text).toContain("Resampling: SoX Resampler");
    expect(text).toContain("Dithering: High-pass triangular");
    expect(text).toContain("Lossless");
    expect(text).toContain("Bit-perfect output");
  });

  it("renders future enum values as safe unknown states", () => {
    const wrapper = mountDetails({
      queue_id: "queue-1",
      queue_item_id: "item-1",
      revision: 1,
      state: "future" as AudioProcessingState,
      input: {
        fidelity: { quality: "future" as AudioQuality },
      },
      queue_processing: {
        crossfade: {
          reason_code: "insufficient_audio",
        },
      },
      outputs: [
        {
          player_ids: ["player-1"],
          fidelity: { quality: "future" as AudioQuality },
        },
      ],
      fidelity: {
        min_output_quality: "future" as AudioQuality,
        max_output_quality: "future" as AudioQuality,
      },
    });

    const text = wrapper.text();
    expect(text).toContain("State unknown");
    expect(text).toContain("Quality unknown");
    expect(text).toContain("Not enough audio to apply the crossfade");
    expect(text).not.toContain("future");
  });

  it("renders unknown output processing enums safely", () => {
    const wrapper = mountDetails({
      queue_id: "queue-1",
      queue_item_id: "item-1",
      revision: 1,
      state: AudioProcessingState.READY,
      outputs: [
        {
          player_ids: ["player-1"],
          dsp: { state: "future" as DSPState },
          channels: { mode: "future" as AudioChannelMode },
          limiter: { enabled: false },
          resampling: { method: "future" as AudioResamplingMethod },
          dithering: { method: "future" as AudioDitheringMethod },
          fidelity: { quality: AudioQuality.UNKNOWN },
        },
      ],
      fidelity: {
        min_output_quality: AudioQuality.UNKNOWN,
        max_output_quality: AudioQuality.UNKNOWN,
      },
    });

    const text = wrapper.text();
    expect(text).toContain("Quality unknown");
    expect(text).toContain("DSP state unknown");
    expect(text).toContain("Channel routing: Unknown");
    expect(text).toContain("Resampling: Unknown");
    expect(text).toContain("Dithering: Unknown");
    expect(text).not.toContain("future");
  });
});

function mountDetails(chain: AudioProcessingChain) {
  return mount(AudioProcessingDetails, {
    props: { chain },
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

function makeFullChain(): AudioProcessingChain {
  const floatPcm = makeFormat({
    content_type: ContentType.PCM_F32LE,
    codec_type: ContentType.PCM_F32LE,
    sample_rate: 48000,
    bit_depth: 32,
  });
  return {
    queue_id: "queue-1",
    queue_item_id: "item-1",
    revision: 7,
    state: AudioProcessingState.READY,
    input: {
      source_format: makeFormat(),
      server_input_format: floatPcm,
      fidelity: { quality: AudioQuality.HI_RES },
    },
    queue_processing: {
      input_format: floatPcm,
      output_format: floatPcm,
      normalization: {
        mode: VolumeNormalizationMode.DYNAMIC,
        measurement_source: AudioNormalizationMeasurementSource.LIVE,
        target_lufs: -14,
        measured_lufs: -12.5,
        applied_gain_db: -1.5,
      },
      tempo: { playback_speed: 1.25 },
      crossfade: {
        mode: CrossfadeMode.SMART_CROSSFADE,
        state: AudioCrossfadeState.APPLIED,
        from_queue_item_id: "item-1",
        to_queue_item_id: "item-2",
        planned_duration: 8,
        actual_duration: 7.5,
      },
      overlay: {
        source: {
          item_id: "rain",
          provider: "test",
          name: "Rain",
          uri: "test://sound_effect/rain",
          is_playable: true,
          media_type: MediaType.SOUND_EFFECT,
          available: true,
        },
        volume_percent: 35,
      },
    },
    outputs: [
      {
        player_ids: ["player-1", "player-2"],
        input_format: floatPcm,
        dsp: {
          state: DSPState.ENABLED,
          input_gain: -1,
          filters: [
            {
              type: DSPFilterType.TONE_CONTROL,
              enabled: true,
              bass_level: 1,
              mid_level: 0,
              treble_level: -1,
            },
          ],
          output_gain: 2,
        },
        channels: { mode: AudioChannelMode.MONO },
        limiter: { enabled: true, threshold_dbfs: -1 },
        resampling: { method: AudioResamplingMethod.SOXR },
        dithering: { method: AudioDitheringMethod.TRIANGULAR_HP },
        handoff_format: makeFormat({
          content_type: ContentType.AAC,
          codec_type: ContentType.AAC,
          sample_rate: 48000,
          bit_depth: 16,
          bit_rate: 256,
        }),
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
    fidelity: {
      min_output_quality: AudioQuality.LOSSLESS,
      max_output_quality: AudioQuality.LOSSLESS,
    },
  };
}
