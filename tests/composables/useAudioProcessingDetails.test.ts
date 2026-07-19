import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAudioProcessingDetailsDisplay,
  type AudioProcessingDetailsDependencies,
} from "@/composables/useAudioProcessingDetails";
import { $t, i18n } from "@/plugins/i18n";
import {
  type AudioFormat,
  type AudioProcessingChain,
  AudioQuality,
  ContentType,
  DSPState,
  MediaType,
  type StreamDetails,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";

vi.mock("@/plugins/api", () => ({
  default: {
    getProviderName: vi.fn(),
    players: {},
  },
}));
vi.mock("@/composables/useDSPPresets", () => ({
  useDSPPresets: () => ({
    getPresetName: vi.fn(),
  }),
}));

const presetNames = new Map<string, string>();
const dependencies: AudioProcessingDetailsDependencies = {
  translate: (key, values) => (values ? $t(key, values) : $t(key)),
  getProviderName: () => "Test provider",
  getPresetName: (presetId) =>
    presetId ? presetNames.get(presetId) : undefined,
  players: {
    kitchen: {
      player_id: "kitchen",
      name: "Kitchen",
      active_output_protocol: "airplay-kitchen",
      output_protocols: [
        {
          output_protocol_id: "airplay-kitchen",
          is_native: false,
        },
      ],
    },
    office: {
      player_id: "office",
      name: "Office",
      active_output_protocol: null,
      output_protocols: [],
    },
  },
};

beforeEach(() => {
  i18n.global.locale.value = "en";
  presetNames.clear();
  presetNames.set("preset-1", "Living room");
});

describe("buildAudioProcessingDetailsDisplay", () => {
  it("distinguishes direct paths from floating-point headroom", () => {
    const sourceFormat = makeFormat({
      sample_rate: 44100,
      bit_depth: 16,
    });
    const direct = buildDisplay(
      {
        queue_processing: {
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S16LE,
            codec_type: ContentType.PCM_S16LE,
            sample_rate: 44100,
            bit_depth: 16,
          }),
        },
        outputs: [
          {
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: { bit_perfect: true },
          },
        ],
      },
      sourceFormat,
    );
    expect(direct.processingStages.map((stage) => stage.title)).toEqual([
      "Direct signal path",
    ]);

    const headroom = buildDisplay(
      {
        queue_processing: {
          pcm_format: makeFormat({
            content_type: ContentType.PCM_F32LE,
            codec_type: ContentType.PCM_F32LE,
            sample_rate: 48000,
            bit_depth: 32,
          }),
          normalization: { mode: VolumeNormalizationMode.DYNAMIC },
        },
        outputs: [
          {
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: { bit_perfect: false },
          },
        ],
      },
      sourceFormat,
    );
    expect(headroom.processingStages.map((stage) => stage.title)).toEqual([
      "Processing headroom",
      "Volume normalization",
    ]);
    expect(headroom.processingStages[0].subtitleParts).toEqual([
      "32-bit float PCM",
    ]);
  });

  it("uses codec-aware fidelity wording", () => {
    const lossy = buildDisplay({
      outputs: [
        {
          player_ids: ["kitchen"],
          output_format: makeFormat({
            content_type: ContentType.M4A,
            codec_type: ContentType.AAC,
          }),
          fidelity: { bit_perfect: false },
        },
      ],
    });
    expect(lossy.outputPaths[0].stages.at(-1)?.details).toContain(
      "The output is encoded with a lossy codec. This is not bit-perfect and may reduce sound quality.",
    );

    const lossless = buildDisplay({
      outputs: [
        {
          player_ids: ["kitchen"],
          output_format: makeFormat(),
          fidelity: { bit_perfect: false },
        },
      ],
    });
    expect(lossless.outputPaths[0].stages.at(-1)?.details).toContain(
      "Audio processing or lossless format conversion changed the audio samples. This is not bit-perfect, but should not cause an audible loss of quality.",
    );
  });

  it("resolves presets and protocol-parent destinations", () => {
    const chain: AudioProcessingChain = {
      input_fidelity: { quality: AudioQuality.LOSSLESS },
      outputs: [
        {
          player_ids: ["airplay-kitchen", "office"],
          dsp: {
            state: DSPState.ENABLED,
            preset_id: "preset-1",
          },
          output_format: makeFormat(),
        },
      ],
    };
    const display = buildDisplay(chain);
    expect(display.outputPaths[0].stages[1].title).toBe("Living room");
    expect(display.outputPaths[0].destination).toMatchObject({
      title: "Kitchen +1",
      details: ["Kitchen", "Office"],
    });

    presetNames.set("preset-1", "Cinema");
    expect(buildDisplay(chain).outputPaths[0].stages[1].title).toBe("Cinema");
  });
});

function buildDisplay(chain: AudioProcessingChain, audioFormat = makeFormat()) {
  const streamDetails: StreamDetails = {
    provider: "test",
    item_id: "track-1",
    audio_format: audioFormat,
    media_type: MediaType.TRACK,
  };
  return buildAudioProcessingDetailsDisplay(chain, streamDetails, dependencies);
}

function makeFormat(overrides: Partial<AudioFormat> = {}): AudioFormat {
  return {
    content_type: ContentType.FLAC,
    codec_type: ContentType.FLAC,
    sample_rate: 48000,
    bit_depth: 16,
    channels: 2,
    output_format_str: "",
    bit_rate: 0,
    ...overrides,
  };
}
