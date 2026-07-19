import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAudioProcessingDetailsDisplay,
  type AudioProcessingDetailsDependencies,
  useAudioProcessingDetails,
} from "@/composables/useAudioProcessingDetails";
import { $t, i18n } from "@/plugins/i18n";
import {
  type AudioFormat,
  type AudioProcessingChain,
  AudioQuality,
  ContentType,
  CrossfadeMode,
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
  locale: "en-US",
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
  dependencies.locale = "en-US";
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

  it.each([CrossfadeMode.UNKNOWN, "future_crossfade" as CrossfadeMode])(
    "keeps %s crossfade in headroom reasons",
    (crossfadeMode) => {
      const display = buildDisplay({
        queue_processing: {
          pcm_format: makeFormat({
            content_type: ContentType.PCM_F32LE,
            codec_type: ContentType.PCM_F32LE,
            bit_depth: 32,
          }),
          crossfade_mode: crossfadeMode,
        },
        outputs: [
          {
            player_ids: ["kitchen"],
            output_format: makeFormat(),
            fidelity: { bit_perfect: false },
          },
        ],
      });

      expect(display.processingStages.map((stage) => stage.title)).toContain(
        "Crossfade: Unknown",
      );
      expect(display.processingStages[0].details).toContain(
        "Floating-point headroom is available for: Crossfade.",
      );
    },
  );

  it("excludes disabled crossfade from headroom reasons", () => {
    const display = buildDisplay({
      queue_processing: {
        pcm_format: makeFormat({
          content_type: ContentType.PCM_F32LE,
          codec_type: ContentType.PCM_F32LE,
          bit_depth: 32,
        }),
        crossfade_mode: CrossfadeMode.DISABLED,
      },
      outputs: [
        {
          player_ids: ["kitchen"],
          output_format: makeFormat(),
          fidelity: { bit_perfect: false },
        },
      ],
    });

    expect(display.processingStages).toHaveLength(1);
    expect(display.processingStages[0].details).not.toContain(
      "Floating-point headroom is available for: Crossfade.",
    );
  });

  it("formats every numeric detail with the supplied locale", () => {
    const audioFormat = makeFormat({
      content_type: ContentType.MP3,
      codec_type: ContentType.MP3,
      sample_rate: 44100,
      bit_rate: 1234,
    });
    const chain: AudioProcessingChain = {
      queue_processing: {
        normalization: {
          mode: VolumeNormalizationMode.DYNAMIC,
          measured_lufs: -12.5,
        },
        playback_speed: 1.25,
      },
      outputs: [
        {
          player_ids: ["kitchen"],
          dsp: {
            state: DSPState.ENABLED,
            input_gain: -1.5,
            output_gain: 2.25,
          },
          output_format: audioFormat,
        },
      ],
    };

    const english = buildDisplay(chain, audioFormat);
    expect(english.inputStages[1].subtitleParts).toContain("44.1 kHz");
    expect(english.inputStages[1].subtitleParts).toContain("1,234 kbps");
    expect(english.processingStages[0].details).toContain(
      "Measured loudness: -12.5 LUFS",
    );
    expect(english.processingStages[1].title).toBe("Playback speed: 1.25x");
    expect(english.outputPaths[0].stages[1].title).toBe("Input Gain (-1.5 dB)");
    expect(english.outputPaths[0].stages[2].title).toBe("Output Gain (2.3 dB)");

    dependencies.locale = "de-DE";
    const german = buildDisplay(chain, audioFormat);
    expect(german.inputStages[1].subtitleParts).toContain("44,1 kHz");
    expect(german.inputStages[1].subtitleParts).toContain("1.234 kbps");
    expect(german.processingStages[0].details).toContain(
      "Measured loudness: -12,5 LUFS",
    );
    expect(german.processingStages[1].title).toBe("Playback speed: 1,25x");
    expect(german.outputPaths[0].stages[1].title).toBe("Input Gain (-1,5 dB)");
    expect(german.outputPaths[0].stages[2].title).toBe("Output Gain (2,3 dB)");
  });

  it("updates number formatting when the selected locale changes", async () => {
    const chain = ref<AudioProcessingChain>({
      queue_processing: { playback_speed: 1.25 },
    });
    const streamDetails = ref<StreamDetails>({
      provider: "test",
      item_id: "track-1",
      audio_format: makeFormat(),
      media_type: MediaType.TRACK,
    });
    const harness = defineComponent({
      setup() {
        const { processingStages } = useAudioProcessingDetails(
          chain,
          streamDetails,
        );
        return () =>
          h(
            "span",
            { "data-testid": "playback-speed" },
            processingStages.value[0]?.title,
          );
      },
    });
    const wrapper = mount(harness, {
      global: { plugins: [i18n] },
    });

    expect(wrapper.get('[data-testid="playback-speed"]').text()).toBe(
      "Playback speed: 1.25x",
    );
    i18n.global.locale.value = "de";
    await nextTick();
    expect(wrapper.get('[data-testid="playback-speed"]').text()).toBe(
      "Playback speed: 1,25x",
    );
    wrapper.unmount();
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
