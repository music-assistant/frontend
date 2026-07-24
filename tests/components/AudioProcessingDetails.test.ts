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

interface PlayerDisplayMock {
  player_id: string;
  name: string;
  provider: string;
  active_output_protocol?: string | null;
  output_protocols?: Array<{
    output_protocol_id: string;
    is_native: boolean;
    protocol_domain?: string | null;
  }>;
}

const apiMock = vi.hoisted(() => ({
  getProviderName: vi.fn(() => "Test provider"),
  getProviderManifest: vi.fn((providerId: string) => ({
    domain: providerId.split("--", 1)[0],
  })),
  // useDSPIRs (via useAudioProcessingDetails) fetches the IR list and
  // subscribes to config updates on mount; subscribe hands back an unsubscribe.
  getDSPIRs: vi.fn(() => Promise.resolve([])),
  subscribe: vi.fn(() => vi.fn()),
  players: {} as Record<string, PlayerDisplayMock>,
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
    "player-1": {
      player_id: "player-1",
      name: "Kitchen",
      provider: "squeezelite--main",
      active_output_protocol: null,
      output_protocols: [],
    },
    "player-2": {
      player_id: "player-2",
      name: "Office",
      provider: "squeezelite--main",
      active_output_protocol: null,
      output_protocols: [],
    },
  };
  getPresetNames().value = new Map([["preset-1", "Living room"]]);
});

describe("AudioProcessingDetails", () => {
  it("renders the embedded processing model and server-grouped outputs", () => {
    const wrapper = mountDetails(makeFullChain());

    expect(
      wrapper
        .findAll("[data-section]")
        .map((section) => section.attributes("data-section")),
    ).toEqual(["input", "processing", "output"]);
    expect(wrapper.findAll('[data-testid="audio-output-path"]')).toHaveLength(
      1,
    );
    expect(
      wrapper
        .find('[data-testid="audio-output-path"]')
        .attributes("data-player-ids"),
    ).toBe("player-1,player-2");
    const groupedDestination = wrapper.find('[data-stage="destination"]');
    expect(
      groupedDestination.find(".audio-processing-stage-title").text(),
    ).toBe("Kitchen +1");
    expect(
      groupedDestination.findAll("li").map((destination) => destination.text()),
    ).toEqual(["Kitchen", "Office"]);
    expect(
      groupedDestination
        .find(".audio-processing-stage-info")
        .attributes("aria-label"),
    ).toBe("More information about Kitchen +1");
    expect(
      wrapper
        .find('[data-stage="provider"]')
        .get('[data-testid="provider-icon"]')
        .attributes("data-domain"),
    ).toBe("filesystem--music");
    expect(
      wrapper
        .find('[data-stage="source-format"]')
        .find(".audio-processing-stage-icon svg")
        .exists(),
    ).toBe(true);
    expect(
      groupedDestination
        .get('[data-testid="provider-icon"]')
        .attributes("data-domain"),
    ).toBe("squeezelite");

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
        "output-format-0",
        "source-channel-0",
      ]),
    );
    expect(stageKeys).not.toContain("bit-perfect-0");
    expect(
      wrapper
        .find('[data-section="input"]')
        .findAll("[data-stage]")
        .map((stage) => stage.attributes("data-stage")),
    ).toEqual(["provider", "source-format"]);
    expect(
      wrapper
        .find('[data-section="processing"]')
        .findAll("[data-stage]")
        .map((stage) => stage.attributes("data-stage")),
    ).toEqual([
      "pcm-format",
      "normalization",
      "playback-speed",
      "crossfade",
      "overlay",
    ]);
    const headroom = wrapper.find('[data-stage="pcm-format"]');
    expect(headroom.find(".audio-processing-stage-title").text()).toBe(
      "Processing headroom",
    );
    expect(headroom.find(".audio-processing-stage-subtitle").text()).toBe(
      "32-bit float PCM",
    );
    expect(headroom.findAll("li").map((detail) => detail.text())).toContain(
      "Floating-point headroom is available for: Volume normalization, Playback speed, Crossfade, Audio overlay, DSP, Output Limiter.",
    );
    expect(
      wrapper
        .find('[data-section="output"]')
        .findAll("[data-stage]")
        .map((stage) => stage.attributes("data-stage")),
    ).toEqual([
      "dsp-state-0",
      "dsp-preset-0",
      "dsp-input-gain-0",
      "dsp-filter-0-0",
      "dsp-filter-0-1",
      "dsp-filter-0-2",
      "dsp-output-gain-0",
      "source-channel-0",
      "output-limiter-0",
      "output-format-0",
      "destination",
    ]);

    const text = wrapper.text();
    expect(
      wrapper
        .find('[data-stage="provider"] .audio-processing-stage-title')
        .text(),
    ).toBe("Test provider");
    expect(text).toContain("32-bit float PCM");
    expect(text).toContain("Playback speed: 1.25x");
    expect(text).toContain("Crossfade: Smart");
    expect(text).toContain("Audio overlay active");
    expect(
      wrapper
        .find('[data-stage="dsp-preset-0"] .audio-processing-stage-title')
        .text(),
    ).toBe("Living room");
    expect(
      wrapper
        .find('[data-stage="dsp-preset-0"] .audio-processing-stage-subtitle')
        .text(),
    ).toBe("DSP preset");
    expect(text).toContain("Gain");
    expect(text).toContain("Balance");
    expect(text).toContain("Source channel: Left");
    expect(text).toContain("Output Limiter");
    expect(text).toContain("Lossless");
    expect(
      wrapper
        .find('[data-stage="output-format-0"] .audio-processing-stage-badge')
        .text(),
    ).toBe("Bit-perfect");
    expect(
      wrapper
        .find('[data-stage="output-format-0"]')
        .findAll("li")
        .map((detail) => detail.text()),
    ).toContain("Bit-perfect: audio samples are unchanged from the source.");
    expect(text).not.toContain("Processed output");
  });

  it("updates a resolved preset name reactively", async () => {
    const wrapper = mountDetails(makeFullChain());
    const preset = wrapper.find(
      '[data-stage="dsp-preset-0"] .audio-processing-stage-title',
    );
    expect(preset.text()).toBe("Living room");

    getPresetNames().value = new Map([["preset-1", "Cinema"]]);
    await nextTick();

    expect(preset.text()).toBe("Cinema");
    expect(wrapper.text()).not.toContain("Living room");
  });

  it("uses Custom for an unresolved preset without exposing its ID", () => {
    getPresetNames().value = new Map();
    const wrapper = mountDetails(makeFullChain());

    expect(
      wrapper
        .find('[data-stage="dsp-preset-0"] .audio-processing-stage-title')
        .text(),
    ).toBe("Custom");
    expect(wrapper.text()).not.toContain("preset-1");
  });

  it("renders future enum values as safe unknown states", () => {
    const wrapper = mountDetails({
      input_fidelity: { quality: "future" as AudioQuality },
      queue_processing: {
        pcm_format: makeFormat({
          content_type: ContentType.PCM_F32LE,
          codec_type: ContentType.PCM_F32LE,
          bit_depth: 32,
        }),
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
    expect(
      wrapper
        .find('[data-stage="pcm-format"]')
        .findAll("li")
        .map((detail) => detail.text()),
    ).toContain("Floating-point headroom is available for: Crossfade.");
  });

  it("excludes disabled crossfade from component headroom reasons", () => {
    const wrapper = mountDetails({
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
          player_ids: ["player-1"],
          fidelity: { bit_perfect: false },
        },
      ],
    });

    expect(
      wrapper
        .find('[data-stage="pcm-format"]')
        .findAll("li")
        .map((detail) => detail.text()),
    ).not.toContain("Floating-point headroom is available for: Crossfade.");
  });

  it("renders audio formats as titles with atomic technical details", () => {
    const sourceFormat = makeFormat({
      content_type: ContentType.OGG,
      codec_type: ContentType.VORBIS,
      sample_rate: 44100,
      bit_depth: 16,
      channels: 2,
      bit_rate: 320,
    });
    const wrapper = mountDetails(
      {
        input_fidelity: { quality: AudioQuality.STANDARD },
        queue_processing: {
          pcm_format: makeFormat({
            content_type: ContentType.PCM_F32LE,
            codec_type: ContentType.PCM_F32LE,
            sample_rate: 48000,
            bit_depth: 32,
          }),
        },
        outputs: [
          {
            player_ids: ["player-1"],
            dsp: { state: DSPState.DISABLED },
            output_format: makeFormat({
              sample_rate: 48000,
              bit_depth: 16,
            }),
            fidelity: {
              quality: AudioQuality.STANDARD,
              bit_perfect: false,
            },
          },
        ],
      },
      makeStreamDetails(sourceFormat),
    );

    const sourceStage = wrapper.find('[data-stage="source-format"]');
    expect(sourceStage.find(".audio-processing-stage-title").text()).toBe(
      "VORBIS",
    );
    expect(
      sourceStage
        .findAll(".audio-processing-stage-subtitle-part")
        .map((part) => part.text()),
    ).toEqual(["44.1 kHz", "· 16-bit", "· Stereo", "· 320 kbps"]);
    expect(
      sourceStage
        .findAll(".audio-processing-stage-subtitle-part")
        .every((part) =>
          part.classes("audio-processing-stage-subtitle-part--atomic"),
        ),
    ).toBe(true);
    const pcmStage = wrapper.find('[data-stage="pcm-format"]');
    expect(pcmStage.find(".audio-processing-stage-title").text()).toBe(
      "Processing headroom",
    );
    expect(
      pcmStage
        .findAll(".audio-processing-stage-subtitle-part")
        .map((part) => part.text()),
    ).toEqual(["32-bit float PCM"]);
    expect(pcmStage.findAll("li").map((detail) => detail.text())).toEqual([
      "Music Assistant converts audio to floating point internally to create headroom and reduce clipping or precision loss during normalization, mixing, crossfade, DSP, and limiting.",
      "Internal format: 32-bit float PCM · 48 kHz · Stereo",
    ]);
    const finalOutput = wrapper.find('[data-stage="output-format-0"]');
    expect(finalOutput.find(".audio-processing-stage-title").text()).toBe(
      "FLAC",
    );
    expect(
      finalOutput
        .findAll(".audio-processing-stage-subtitle-part")
        .map((part) => part.text()),
    ).toEqual(["48 kHz", "· 16-bit", "· Stereo"]);
    expect(wrapper.text()).not.toContain("DSP disabled");
    expect(wrapper.find('[data-stage="dsp-state-0"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Processed output");
    expect(finalOutput.find(".audio-processing-stage-badge").exists()).toBe(
      false,
    );
    expect(finalOutput.findAll("li").map((detail) => detail.text())).toContain(
      "Audio processing or lossless format conversion changed the audio samples. This is not bit-perfect, but should not cause an audible loss of quality.",
    );
    expect(
      wrapper
        .find('[data-stage="destination"]')
        .classes("audio-processing-stage--terminal"),
    ).toBe(true);
  });

  it.each([
    {
      label: "MP3 content fallback",
      contentType: ContentType.MP3,
      codecType: ContentType.UNKNOWN,
    },
    {
      label: "AAC codec",
      contentType: ContentType.M4A,
      codecType: ContentType.AAC,
    },
    {
      label: "Opus codec",
      contentType: ContentType.OGG,
      codecType: ContentType.OPUS,
    },
    {
      label: "G.722 voice codec",
      contentType: ContentType.WAV,
      codecType: ContentType.G722,
    },
  ])(
    "warns when a non-bit-perfect output uses $label",
    ({ contentType, codecType }) => {
      const wrapper = mountDetails({
        outputs: [
          {
            player_ids: ["player-1"],
            output_format: makeFormat({
              content_type: contentType,
              codec_type: codecType,
            }),
            fidelity: {
              quality: AudioQuality.STANDARD,
              bit_perfect: false,
            },
          },
        ],
      });

      expect(
        wrapper
          .find('[data-stage="output-format-0"]')
          .findAll("li")
          .map((detail) => detail.text()),
      ).toContain(
        "The output is encoded with a lossy codec. This is not bit-perfect and may reduce sound quality.",
      );
    },
  );

  it.each([
    {
      label: "FLAC",
      contentType: ContentType.FLAC,
      codecType: ContentType.FLAC,
    },
    {
      label: "PCM",
      contentType: ContentType.PCM_S16LE,
      codecType: ContentType.PCM_S16LE,
    },
  ])(
    "uses gentle non-bit-perfect wording for $label output",
    ({ contentType, codecType }) => {
      const wrapper = mountDetails({
        outputs: [
          {
            player_ids: ["player-1"],
            output_format: makeFormat({
              content_type: contentType,
              codec_type: codecType,
            }),
            fidelity: {
              quality: AudioQuality.LOSSLESS,
              bit_perfect: false,
            },
          },
        ],
      });

      expect(
        wrapper
          .find('[data-stage="output-format-0"]')
          .findAll("li")
          .map((detail) => detail.text()),
      ).toContain(
        "Audio processing or lossless format conversion changed the audio samples. This is not bit-perfect, but should not cause an audible loss of quality.",
      );
    },
  );

  it("prefers a known lossless codec over a lossy container", () => {
    const wrapper = mountDetails({
      outputs: [
        {
          player_ids: ["player-1"],
          output_format: makeFormat({
            content_type: ContentType.MP3,
            codec_type: ContentType.FLAC,
          }),
          fidelity: {
            quality: AudioQuality.LOSSLESS,
            bit_perfect: false,
          },
        },
      ],
    });

    expect(
      wrapper
        .find('[data-stage="output-format-0"]')
        .findAll("li")
        .map((detail) => detail.text()),
    ).toContain(
      "Audio processing or lossless format conversion changed the audio samples. This is not bit-perfect, but should not cause an audible loss of quality.",
    );
  });

  it("explains unknown final-output fidelity in the format tooltip", () => {
    const wrapper = mountDetails({
      outputs: [
        {
          player_ids: ["player-1"],
          output_format: makeFormat({
            sample_rate: 48000,
            bit_depth: 16,
          }),
          fidelity: { quality: AudioQuality.STANDARD },
        },
      ],
    });

    const finalOutput = wrapper.find('[data-stage="output-format-0"]');
    expect(finalOutput.find(".audio-processing-stage-badge").exists()).toBe(
      false,
    );
    expect(finalOutput.findAll("li").map((detail) => detail.text())).toContain(
      "Bit-perfect status is unavailable.",
    );
  });

  it("summarizes an unchanged shared path as direct", () => {
    const sourceFormat = makeFormat({
      sample_rate: 44100,
      bit_depth: 16,
    });
    const wrapper = mountDetails(
      {
        input_fidelity: { quality: AudioQuality.LOSSLESS },
        queue_processing: {
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S16LE,
            codec_type: ContentType.PCM_S16LE,
            sample_rate: 44100,
            bit_depth: 16,
          }),
          normalization: { mode: VolumeNormalizationMode.DISABLED },
          playback_speed: 1,
          crossfade_mode: CrossfadeMode.DISABLED,
          overlay_active: false,
        },
        outputs: [
          {
            player_ids: ["player-1"],
            dsp: { state: DSPState.DISABLED },
            output_format: sourceFormat,
            fidelity: {
              quality: AudioQuality.LOSSLESS,
              bit_perfect: true,
            },
          },
        ],
      },
      makeStreamDetails(sourceFormat),
    );

    const processing = wrapper.find('[data-section="processing"]');
    expect(
      processing
        .findAll("[data-stage]")
        .map((stage) => stage.attributes("data-stage")),
    ).toEqual(["pcm-format"]);
    const directPath = processing.find('[data-stage="pcm-format"]');
    expect(directPath.find(".audio-processing-stage-title").text()).toBe(
      "Direct signal path",
    );
    expect(directPath.find(".audio-processing-stage-subtitle").exists()).toBe(
      false,
    );
    expect(directPath.findAll("li").map((detail) => detail.text())).toEqual([
      "Audio passes through queue processing unchanged.",
      "Internal format: 16-bit PCM · 44.1 kHz · Stereo",
      "No volume normalization, crossfade, playback speed adjustment, or audio overlay is active.",
    ]);
    expect(wrapper.find('[data-stage="dsp-state-0"]').exists()).toBe(false);
    const destination = wrapper.find('[data-stage="destination"]');
    expect(destination.find(".audio-processing-stage-title").text()).toBe(
      "Kitchen",
    );
    expect(destination.find(".audio-processing-stage-info").exists()).toBe(
      false,
    );
  });

  it("does not claim an unchanged path when output fidelity changed", () => {
    const sourceFormat = makeFormat({
      sample_rate: 44100,
      bit_depth: 16,
    });
    const wrapper = mountDetails(
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
            player_ids: ["player-1"],
            output_format: sourceFormat,
            fidelity: {
              quality: AudioQuality.LOSSLESS,
              bit_perfect: false,
            },
          },
        ],
      },
      makeStreamDetails(sourceFormat),
    );

    const context = wrapper.find('[data-stage="pcm-format"]');
    expect(context.find(".audio-processing-stage-title").text()).toBe(
      "No shared transforms reported",
    );
    expect(context.text()).not.toContain("Direct signal path");
    expect(context.findAll("li").map((detail) => detail.text())).toEqual([
      "No normalization, crossfade, playback speed adjustment, or audio overlay is reported by the processing model.",
      "Internal format: 16-bit PCM · 44.1 kHz · Stereo",
    ]);
  });

  it("keeps unsupported-group DSP state visible", () => {
    const wrapper = mountDetails({
      outputs: [
        {
          player_ids: ["player-1"],
          dsp: { state: DSPState.DISABLED_BY_UNSUPPORTED_GROUP },
          output_format: makeFormat(),
        },
      ],
    });

    expect(
      wrapper
        .find('[data-stage="dsp-state-0"] .audio-processing-stage-title')
        .text(),
    ).toBe("DSP unavailable for this group");
  });

  it("hides disabled DSP while retaining limiter headroom context", () => {
    const sourceFormat = makeFormat({
      sample_rate: 48000,
      bit_depth: 16,
    });
    const wrapper = mountDetails(
      {
        queue_processing: {
          pcm_format: makeFormat({
            content_type: ContentType.PCM_F32LE,
            codec_type: ContentType.PCM_F32LE,
            sample_rate: 48000,
            bit_depth: 32,
          }),
        },
        outputs: [
          {
            player_ids: ["player-1"],
            dsp: {
              state: DSPState.DISABLED,
              output_limiter: true,
            },
            output_format: sourceFormat,
          },
        ],
      },
      makeStreamDetails(sourceFormat),
    );

    expect(wrapper.find('[data-stage="dsp-state-0"]').exists()).toBe(false);
    expect(wrapper.find('[data-stage="output-limiter-0"]').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-stage="pcm-format"]')
        .findAll("li")
        .map((detail) => detail.text()),
    ).toContain("Floating-point headroom is available for: Output Limiter.");
  });

  it("keeps missing destination IDs visible in the grouped detail list", () => {
    const wrapper = mountDetails({
      outputs: [
        {
          player_ids: ["missing-1", "missing-2"],
          output_format: makeFormat(),
        },
      ],
    });

    const destination = wrapper.find('[data-stage="destination"]');
    expect(destination.find(".audio-processing-stage-title").text()).toBe(
      "Destination missing-1 +1",
    );
    expect(destination.findAll("li").map((detail) => detail.text())).toEqual([
      "Destination missing-1",
      "Destination missing-2",
    ]);
  });

  it("resolves protocol output IDs to their parent player", () => {
    apiMock.players["player-1"].active_output_protocol = "airplay-kitchen";
    apiMock.players["player-1"].output_protocols = [
      {
        output_protocol_id: "airplay-kitchen",
        is_native: false,
        protocol_domain: "airplay",
      },
    ];
    const wrapper = mountDetails({
      outputs: [
        {
          player_ids: ["airplay-kitchen", "player-2"],
          output_format: makeFormat(),
        },
      ],
    });

    const destination = wrapper.find('[data-stage="destination"]');
    expect(destination.find(".audio-processing-stage-title").text()).toBe(
      "Kitchen +1",
    );
    expect(destination.findAll("li").map((detail) => detail.text())).toEqual([
      "Kitchen",
      "Office",
    ]);
    expect(destination.find('[data-testid="provider-icon"]').exists()).toBe(
      false,
    );
  });

  it("renders the active output protocol icon for a parent destination", () => {
    apiMock.players["player-1"].active_output_protocol = "airplay-kitchen";
    apiMock.players["player-1"].output_protocols = [
      {
        output_protocol_id: "airplay-kitchen",
        is_native: false,
        protocol_domain: "airplay",
      },
    ];
    const wrapper = mountDetails({
      outputs: [
        {
          player_ids: ["player-1"],
          output_format: makeFormat(),
        },
      ],
    });

    const destination = wrapper.find('[data-stage="destination"]');
    expect(
      destination
        .get('[data-testid="provider-icon"]')
        .attributes("data-domain"),
    ).toBe("airplay");
  });

  it("keeps large destination groups in one complete detail list", () => {
    const playerIds = Array.from(
      { length: 20 },
      (_, index) => `player-${index}`,
    );
    for (const [index, playerId] of playerIds.entries()) {
      apiMock.players[playerId] = {
        player_id: playerId,
        name: `Room ${index + 1}`,
        provider: "squeezelite--main",
        active_output_protocol: null,
        output_protocols: [],
      };
    }
    const wrapper = mountDetails({
      outputs: [
        {
          player_ids: playerIds,
          output_format: makeFormat(),
        },
      ],
    });

    const destination = wrapper.find('[data-stage="destination"]');
    expect(destination.find(".audio-processing-stage-title").text()).toBe(
      "Room 1 +19",
    );
    expect(destination.findAll("li")).toHaveLength(20);
    expect(destination.findAll("li").at(-1)?.text()).toBe("Room 20");
  });

  it("keeps multiple output paths separate and terminates the final path", () => {
    const wrapper = mountDetails({
      outputs: [
        {
          player_ids: ["player-1"],
          fidelity: { quality: AudioQuality.LOSSLESS },
        },
        {
          player_ids: ["player-2"],
          fidelity: { quality: AudioQuality.HI_RES },
        },
      ],
    });

    expect(
      wrapper
        .findAll("[data-section]")
        .map((section) => section.attributes("data-section")),
    ).toEqual(["input", "processing", "output", "output"]);
    expect(
      wrapper
        .findAll('[data-testid="audio-output-path"]')
        .map((output) => output.attributes("data-player-ids")),
    ).toEqual(["player-1", "player-2"]);
    const destinations = wrapper.findAll('[data-stage="destination"]');
    expect(destinations.map((destination) => destination.text())).toEqual([
      "Kitchen",
      "Office",
    ]);
    expect(
      destinations.map((destination) =>
        destination.classes("audio-processing-stage--terminal"),
      ),
    ).toEqual([false, true]);
  });
});

function mountDetails(
  chain: AudioProcessingChain,
  streamDetails = makeStreamDetails(),
) {
  return mount(AudioProcessingDetails, {
    props: {
      chain,
      streamDetails,
    },
    global: {
      plugins: [i18n],
      stubs: {
        Popover: { template: "<div><slot /></div>" },
        PopoverContent: { template: "<div><slot /></div>" },
        PopoverTrigger: { template: "<div><slot /></div>" },
        ProviderIcon: {
          props: ["domain"],
          template:
            '<span data-testid="provider-icon" :data-domain="domain" />',
        },
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

function makeStreamDetails(audioFormat = makeFormat()): StreamDetails {
  return {
    provider: "filesystem--music",
    item_id: "track-1",
    audio_format: audioFormat,
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
