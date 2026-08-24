import { mount } from "@vue/test-utils";
import { File as FileIcon, Merge, Split } from "@lucide/vue";
import { defineComponent, h, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAudioProcessingDetailsDisplay,
  type AudioProcessingDetailsDependencies,
  useAudioProcessingDetails,
} from "@/composables/useAudioProcessingDetails";
import { $t, i18n } from "@/plugins/i18n";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  AudioChannel,
  type AudioFormat,
  type AudioProcessingChain,
  AudioQuality,
  ContentType,
  CrossfadeMode,
  DSPState,
  type StreamDetails,
  VolumeNormalizationMode,
} from "@/plugins/api/interfaces";
import {
  audioDSPDetails,
  audioFidelity,
  audioNormalizationDetails,
  audioOutputDetails,
  audioProcessingChain,
  audioQueueProcessing,
} from "../fixtures/audioProcessing";
import { audioFormat } from "../fixtures/audioFormat";
import { outputProtocol } from "../fixtures/outputProtocol";
import { streamDetails } from "../fixtures/streamDetails";

vi.mock("@/plugins/api", async () => {
  const { providerManifest } = await import("../fixtures/providerManifest");
  return {
    default: {
      getProviderName: vi.fn<MusicAssistantApi["getProviderName"]>(),
      getProviderManifest: vi.fn<MusicAssistantApi["getProviderManifest"]>(
        (providerId: string) => providerManifest({ domain: providerId }),
      ),
      players: {},
    },
  };
});

it.each([
  [CrossfadeMode.SMART_CROSSFADE, "Smart"],
  [CrossfadeMode.STANDARD_CROSSFADE, "Standard"],
])(
  "shows %s crossfade intent before a transition is reported",
  (crossfadeIntent, label) => {
    const display = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          crossfade_mode: CrossfadeMode.DISABLED,
        }),
      },
      makeFormat(),
      crossfadeIntent,
    );

    expect(
      display.processingStages.find((stage) => stage.key === "crossfade"),
    ).toMatchObject({
      title: "Crossfade",
      subtitleParts: [label],
    });
  },
);

it("prefers crossfade intent over the reported fallback mode", () => {
  const display = buildDisplay(
    {
      queue_processing: audioQueueProcessing({
        crossfade_mode: CrossfadeMode.STANDARD_CROSSFADE,
      }),
    },
    makeFormat(),
    CrossfadeMode.SMART_CROSSFADE,
  );

  expect(
    display.processingStages.find((stage) => stage.key === "crossfade"),
  ).toMatchObject({
    title: "Crossfade",
    subtitleParts: ["Smart"],
  });
});
vi.mock("@/composables/useDSPPresets", () => ({
  useDSPPresets: () => ({
    getPresetName: vi.fn(),
  }),
}));
vi.mock("@/composables/useDSPIRs", () => ({
  useDSPIRs: () => ({
    getIRName: vi.fn(),
  }),
}));

const presetNames = new Map<string, string>();
const irNames = new Map<string, string>();
const dependencies: AudioProcessingDetailsDependencies = {
  translate: (key, values) => (values ? $t(key, values) : $t(key)),
  locale: "en-US",
  getProviderName: () => "Test provider",
  getProviderDomain: (providerId) => providerId.split("--", 1)[0],
  getPresetName: (presetId) =>
    presetId ? presetNames.get(presetId) : undefined,
  getIRName: (irId) => (irId ? irNames.get(irId) : undefined),
  players: makePlayers(),
};

beforeEach(() => {
  i18n.global.locale.value = "en";
  dependencies.locale = "en-US";
  dependencies.players = makePlayers();
  presetNames.clear();
  presetNames.set("preset-1", "Living room");
  irNames.clear();
  irNames.set("ir-1", "Living room correction");
});

describe("buildAudioProcessingDetailsDisplay", () => {
  it("uses provider and file icons for the input path", () => {
    const display = buildDisplay({});

    expect(display.inputStages[0]).toMatchObject({
      title: "Test provider",
      providerIconDomain: "test--instance",
    });
    expect(display.inputStages[1]).toMatchObject({
      title: "FLAC",
      icon: FileIcon,
    });
  });

  it.each([
    ContentType.FLAC,
    ContentType.PCM_F32LE,
    ContentType.ADPCM_IMA,
    ContentType.DSD_MSBF,
    ContentType.WAVPACK,
  ])("uses the generic file icon for %s", (contentType) => {
    const format = makeFormat({
      content_type: contentType,
      codec_type: contentType,
    });
    const display = buildDisplay(
      {
        outputs: [
          audioOutputDetails({ player_ids: ["office"], output_format: format }),
        ],
      },
      format,
    );

    expect(display.inputStages[1]).toMatchObject({ icon: FileIcon });
    expect(display.outputPaths[0].stages.at(-1)).toMatchObject({
      icon: FileIcon,
    });
  });

  it("uses the native player provider for direct output", () => {
    const destination = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["office"],
          output_format: makeFormat(),
        }),
      ],
    }).outputPaths[0].destination;

    expect(destination).toMatchObject({
      title: "Office",
      providerIconDomain: "squeezelite",
    });
  });

  it.each(["airplay", "sendspin", "snapcast", "msx_bridge"])(
    "uses the exact active %s protocol domain",
    (protocolDomain) => {
      const protocolId = `${protocolDomain}-kitchen`;
      dependencies.players.kitchen.active_output_protocol = protocolId;
      dependencies.players.kitchen.output_protocols = [
        outputProtocol({
          output_protocol_id: protocolId,
          protocol_domain: protocolDomain,
        }),
      ];

      const destination = buildDisplay({
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: makeFormat(),
          }),
        ],
      }).outputPaths[0].destination;

      expect(destination).toMatchObject({
        title: "Kitchen",
        providerIconDomain: protocolDomain,
      });
    },
  );

  it("resolves older protocol IDs to one visible parent", () => {
    const destination = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["airplay-kitchen", "kitchen"],
          output_format: makeFormat(),
        }),
      ],
    }).outputPaths[0].destination;

    expect(destination).toMatchObject({
      title: "Kitchen",
      providerIconDomain: "airplay",
    });
    expect(destination.details).toBeUndefined();
  });

  it("never falls back to the base provider for an unresolved active protocol", () => {
    dependencies.players.kitchen.active_output_protocol = "missing-protocol";
    dependencies.players.kitchen.output_protocols = [];
    dependencies.players["missing-protocol"] = {
      player_id: "missing-protocol",
      name: "Unrelated protocol player",
      provider: "snapcast--other",
      active_output_protocol: null,
      output_protocols: [],
    };

    const destination = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen"],
          output_format: makeFormat(),
        }),
      ],
    }).outputPaths[0].destination;

    expect(destination).toHaveProperty("icon");
    expect(destination).not.toHaveProperty("providerIconDomain");
  });

  it.each(["snapcast", "msx_bridge"])(
    "uses a visible %s destination provider without a parent mapping",
    (providerDomain) => {
      const playerId = `${providerDomain}-room`;
      dependencies.players.kitchen.output_protocols = [];
      dependencies.players[playerId] = {
        player_id: playerId,
        name: "Visible destination",
        provider: `${providerDomain}--main`,
        active_output_protocol: null,
        output_protocols: [],
      };

      const destination = buildDisplay({
        outputs: [
          audioOutputDetails({
            player_ids: [playerId],
            output_format: makeFormat(),
          }),
        ],
      }).outputPaths[0].destination;

      expect(destination).toMatchObject({
        title: "Visible destination",
        providerIconDomain: providerDomain,
      });
    },
  );

  it("keeps a missing protocol ID generic without an exact parent mapping", () => {
    dependencies.players.kitchen.output_protocols = [];

    const destination = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["airplay-kitchen"],
          output_format: makeFormat(),
        }),
      ],
    }).outputPaths[0].destination;

    expect(destination.title).toBe("Destination airplay-kitchen");
    expect(destination).toHaveProperty("icon");
    expect(destination).not.toHaveProperty("providerIconDomain");
  });

  it("uses a provider icon only for grouped destinations on one domain", () => {
    dependencies.players.kitchen.active_output_protocol = "native";
    dependencies.players.office.provider = "sonos--office";
    let destination = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen", "office"],
          output_format: makeFormat(),
        }),
      ],
    }).outputPaths[0].destination;
    expect(destination).toMatchObject({ providerIconDomain: "sonos" });

    dependencies.players.office.provider = "squeezelite--office";
    destination = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen", "office"],
          output_format: makeFormat(),
        }),
      ],
    }).outputPaths[0].destination;
    expect(destination).toHaveProperty("icon");
    expect(destination).not.toHaveProperty("providerIconDomain");
  });

  it("uses a shared active protocol icon for grouped output", () => {
    dependencies.players.office.active_output_protocol = "airplay-office";
    dependencies.players.office.output_protocols = [
      outputProtocol({ output_protocol_id: "airplay-office" }),
    ];
    let destination = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen", "office"],
          output_format: makeFormat(),
        }),
      ],
    }).outputPaths[0].destination;
    expect(destination).toMatchObject({ providerIconDomain: "airplay" });

    dependencies.players.office.output_protocols[0].protocol_domain =
      "snapcast";
    destination = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen", "office"],
          output_format: makeFormat(),
        }),
      ],
    }).outputPaths[0].destination;
    expect(destination).toHaveProperty("icon");
    expect(destination).not.toHaveProperty("providerIconDomain");
  });

  it("distinguishes direct paths from floating-point headroom", () => {
    const sourceFormat = makeFormat({
      sample_rate: 44100,
      bit_depth: 16,
    });
    const direct = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S16LE,
            codec_type: ContentType.PCM_S16LE,
            sample_rate: 44100,
            bit_depth: 16,
          }),
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: audioFidelity({ bit_perfect: true }),
          }),
        ],
      },
      sourceFormat,
    );
    expect(direct.processingStages.map((stage) => stage.title)).toEqual([
      "Direct signal path",
    ]);

    const headroom = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_F32LE,
            codec_type: ContentType.PCM_F32LE,
            sample_rate: 48000,
            bit_depth: 32,
          }),
          normalization: audioNormalizationDetails({
            mode: VolumeNormalizationMode.DYNAMIC,
          }),
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: audioFidelity({ bit_perfect: false }),
          }),
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
        audioOutputDetails({
          player_ids: ["kitchen"],
          output_format: makeFormat({
            content_type: ContentType.M4A,
            codec_type: ContentType.AAC,
          }),
          fidelity: audioFidelity({ bit_perfect: false }),
        }),
      ],
    });
    expect(lossy.outputPaths[0].stages.at(-1)?.details).toContain(
      "The output is encoded with a lossy codec. This is not bit-perfect and may reduce sound quality.",
    );

    const lossless = buildDisplay({
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen"],
          output_format: makeFormat(),
          fidelity: audioFidelity({ bit_perfect: false }),
        }),
      ],
    });
    expect(lossless.outputPaths[0].stages.at(-1)?.details).toContain(
      "Audio processing or lossless format conversion changed the audio samples. This is not bit-perfect, but should not cause an audible loss of quality.",
    );
  });

  it("resolves presets and protocol-parent destinations", () => {
    const chain: Partial<AudioProcessingChain> = {
      input_fidelity: audioFidelity({ quality: AudioQuality.LOSSLESS }),
      outputs: [
        audioOutputDetails({
          player_ids: ["airplay-kitchen", "office"],
          dsp: audioDSPDetails({
            state: DSPState.ENABLED,
            preset_id: "preset-1",
          }),
          output_format: makeFormat(),
        }),
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

  it.each([
    [AudioChannel.ALL, "Mixed to mono", Merge],
    [AudioChannel.FL, "Source channel: Left", Split],
    [AudioChannel.FR, "Source channel: Right", Split],
  ])(
    "pairs source channel %s with its own title and icon",
    (sourceChannel, title, icon) => {
      const display = buildDisplay({
        outputs: [
          audioOutputDetails({
            player_ids: ["office"],
            source_channel: sourceChannel,
            output_format: makeFormat(),
          }),
        ],
      });

      expect(
        display.outputPaths[0].stages.find((stage) =>
          stage.key.startsWith("source-channel-"),
        ),
      ).toMatchObject({ title, icon });
    },
  );

  it.each([CrossfadeMode.UNKNOWN, "future_crossfade" as CrossfadeMode])(
    "keeps %s crossfade in headroom reasons",
    (crossfadeMode) => {
      const display = buildDisplay({
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_F32LE,
            codec_type: ContentType.PCM_F32LE,
            bit_depth: 32,
          }),
          crossfade_mode: crossfadeMode,
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: makeFormat(),
            fidelity: audioFidelity({ bit_perfect: false }),
          }),
        ],
      });

      expect(
        display.processingStages.find((stage) => stage.key === "crossfade"),
      ).toMatchObject({
        title: "Crossfade",
        subtitleParts: ["Unknown"],
      });
      expect(display.processingStages[0].details).toContain(
        "Floating-point headroom is available for: Crossfade.",
      );
    },
  );

  it("excludes disabled crossfade from headroom reasons", () => {
    const display = buildDisplay({
      queue_processing: audioQueueProcessing({
        pcm_format: makeFormat({
          content_type: ContentType.PCM_F32LE,
          codec_type: ContentType.PCM_F32LE,
          bit_depth: 32,
        }),
        crossfade_mode: CrossfadeMode.DISABLED,
      }),
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen"],
          output_format: makeFormat(),
          fidelity: audioFidelity({ bit_perfect: false }),
        }),
      ],
    });

    expect(display.processingStages).toHaveLength(1);
    expect(display.processingStages[0].details).not.toContain(
      "Floating-point headroom is available for: Crossfade.",
    );
  });

  it("keeps the path direct when the source handled the processing", () => {
    const sourceFormat = makeFormat({ sample_rate: 44100, bit_depth: 16 });
    const display = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S16LE,
            codec_type: ContentType.PCM_S16LE,
            sample_rate: 44100,
            bit_depth: 16,
          }),
          normalization: audioNormalizationDetails({
            mode: VolumeNormalizationMode.SOURCE,
          }),
          crossfade_mode: CrossfadeMode.SOURCE,
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: audioFidelity({ bit_perfect: true }),
          }),
        ],
      },
      sourceFormat,
      CrossfadeMode.SMART_CROSSFADE,
    );

    // both steps are reported, but neither is ours, so the shared path stays direct
    expect(display.processingStages.map((stage) => stage.title)).toEqual([
      "Direct signal path",
      "Volume normalization",
      "Crossfade",
    ]);
    const normalization = display.processingStages[1];
    expect(normalization.subtitleParts).toEqual(["Applied by Test provider"]);
    expect(display.processingStages[2].subtitleParts).toEqual([
      "Applied by Test provider",
    ]);
    // our target and measurement describe neither, so there is nothing to list
    expect(normalization.details).toEqual([]);
  });

  it("still reports a transform of ours alongside a source-handled one", () => {
    const sourceFormat = makeFormat({ sample_rate: 44100, bit_depth: 16 });
    const display = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S16LE,
            codec_type: ContentType.PCM_S16LE,
            sample_rate: 44100,
            bit_depth: 16,
          }),
          normalization: audioNormalizationDetails({
            mode: VolumeNormalizationMode.SOURCE,
          }),
          playback_speed: 1.25,
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: audioFidelity({ bit_perfect: true }),
          }),
        ],
      },
      sourceFormat,
    );

    // the speed change is ours, so the path is no longer direct
    expect(display.processingStages.map((stage) => stage.title)).toEqual([
      "Volume normalization",
      "Playback speed: 1.25x",
    ]);
  });

  it("lets a normalization of ours suppress the direct path", () => {
    const sourceFormat = makeFormat({ sample_rate: 44100, bit_depth: 16 });
    const display = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S16LE,
            codec_type: ContentType.PCM_S16LE,
            sample_rate: 44100,
            bit_depth: 16,
          }),
          normalization: audioNormalizationDetails({
            mode: VolumeNormalizationMode.MEASUREMENT_ONLY,
          }),
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: audioFidelity({ bit_perfect: true }),
          }),
        ],
      },
      sourceFormat,
    );

    expect(display.processingStages.map((stage) => stage.title)).not.toContain(
      "Direct signal path",
    );
  });

  it("does not call a provider's own wider handoff an internal conversion", () => {
    // a Spotify soloist stream: a 24-bit tier decoded upstream and handed over as
    // 32-bit PCM, so Music Assistant received the wider container rather than made it
    const sourceFormat = makeFormat({
      content_type: ContentType.FLAC,
      codec_type: ContentType.FLAC,
      sample_rate: 44100,
      bit_depth: 24,
    });
    const display = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S32LE,
            codec_type: ContentType.PCM_S32LE,
            sample_rate: 44100,
            bit_depth: 32,
          }),
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: audioFidelity({ bit_perfect: true }),
          }),
        ],
      },
      sourceFormat,
    );

    expect(display.processingStages.map((stage) => stage.title)).toEqual([
      "Direct signal path",
    ]);
  });

  it("still reports an internal format that narrows the source", () => {
    const sourceFormat = makeFormat({
      content_type: ContentType.FLAC,
      codec_type: ContentType.FLAC,
      sample_rate: 44100,
      bit_depth: 24,
    });
    const display = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S16LE,
            codec_type: ContentType.PCM_S16LE,
            sample_rate: 44100,
            bit_depth: 16,
          }),
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            fidelity: audioFidelity({ bit_perfect: false }),
          }),
        ],
      },
      sourceFormat,
    );

    expect(display.processingStages.map((stage) => stage.title)).toEqual([
      "Internal format conversion",
    ]);
  });

  it("does not contradict itself when only the source processed the audio", () => {
    const sourceFormat = makeFormat({ sample_rate: 44100, bit_depth: 16 });
    const display = buildDisplay(
      {
        queue_processing: audioQueueProcessing({
          pcm_format: makeFormat({
            content_type: ContentType.PCM_S16LE,
            codec_type: ContentType.PCM_S16LE,
            sample_rate: 44100,
            bit_depth: 16,
          }),
          normalization: audioNormalizationDetails({
            mode: VolumeNormalizationMode.SOURCE,
          }),
          crossfade_mode: CrossfadeMode.SOURCE,
        }),
        outputs: [
          audioOutputDetails({
            player_ids: ["kitchen"],
            output_format: sourceFormat,
            // an output that is not bit-perfect takes the other half of the fork
            fidelity: audioFidelity({ bit_perfect: false }),
          }),
        ],
      },
      sourceFormat,
    );

    const context = display.processingStages[0];
    expect(context.title).toBe("No shared transforms reported");
    // the panel lists the source's two steps two rows below, so this line has to
    // speak for us rather than for the processing model as a whole
    expect(context.details).toContain(
      "Music Assistant applies no normalization, crossfade, playback speed adjustment, or audio overlay.",
    );
  });

  it("excludes source-handled processing from headroom reasons", () => {
    const display = buildDisplay({
      queue_processing: audioQueueProcessing({
        pcm_format: makeFormat({
          content_type: ContentType.PCM_F32LE,
          codec_type: ContentType.PCM_F32LE,
          bit_depth: 32,
        }),
        normalization: audioNormalizationDetails({
          mode: VolumeNormalizationMode.SOURCE,
        }),
        crossfade_mode: CrossfadeMode.SOURCE,
      }),
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen"],
          output_format: makeFormat(),
          fidelity: audioFidelity({ bit_perfect: false }),
          dsp: audioDSPDetails({ state: DSPState.ENABLED, output_gain: -3 }),
        }),
      ],
    });

    const headroom = display.processingStages[0];
    expect(headroom.title).toBe("Processing headroom");
    expect(headroom.details).toContain(
      "Floating-point headroom is available for: DSP.",
    );
  });

  it("formats every numeric detail with the supplied locale", () => {
    const format = makeFormat({
      content_type: ContentType.MP3,
      codec_type: ContentType.MP3,
      sample_rate: 44100,
      bit_rate: 1234,
    });
    const chain: Partial<AudioProcessingChain> = {
      queue_processing: audioQueueProcessing({
        normalization: audioNormalizationDetails({
          mode: VolumeNormalizationMode.DYNAMIC,
          measured_lufs: -12.5,
        }),
        playback_speed: 1.25,
      }),
      outputs: [
        audioOutputDetails({
          player_ids: ["kitchen"],
          dsp: audioDSPDetails({
            state: DSPState.ENABLED,
            input_gain: -1.5,
            output_gain: 2.25,
          }),
          output_format: format,
        }),
      ],
    };

    const english = buildDisplay(chain, format);
    expect(english.inputStages[1].subtitleParts).toContain("44.1 kHz");
    expect(english.inputStages[1].subtitleParts).toContain("1,234 kbps");
    expect(english.processingStages[0].details).toContain(
      "Measured loudness: -12.5 LUFS",
    );
    expect(english.processingStages[1].title).toBe("Playback speed: 1.25x");
    expect(english.outputPaths[0].stages[1].title).toBe("Input Gain (-1.5 dB)");
    expect(english.outputPaths[0].stages[2].title).toBe("Output Gain (2.3 dB)");

    dependencies.locale = "de-DE";
    const german = buildDisplay(chain, format);
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
    const chain = ref<AudioProcessingChain>(
      audioProcessingChain({
        queue_processing: audioQueueProcessing({ playback_speed: 1.25 }),
      }),
    );
    const details = ref<StreamDetails>(
      streamDetails({
        provider: "test",
        item_id: "track-1",
        audio_format: makeFormat(),
      }),
    );
    const harness = defineComponent({
      setup() {
        const { processingStages } = useAudioProcessingDetails(chain, details);
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
      $t("streamdetails.audio_processing.playback_speed", ["1.25"]),
    );
    i18n.global.locale.value = "de";
    await nextTick();
    expect(wrapper.get('[data-testid="playback-speed"]').text()).toBe(
      $t("streamdetails.audio_processing.playback_speed", ["1,25"]),
    );
    wrapper.unmount();
  });
});

function buildDisplay(
  chain: Partial<AudioProcessingChain> = {},
  format = makeFormat(),
  crossfadeIntent?: CrossfadeMode,
) {
  return buildAudioProcessingDetailsDisplay(
    audioProcessingChain(chain),
    streamDetails({
      provider: "test--instance",
      item_id: "track-1",
      audio_format: format,
    }),
    dependencies,
    crossfadeIntent,
  );
}

function makePlayers(): AudioProcessingDetailsDependencies["players"] {
  return {
    kitchen: {
      player_id: "kitchen",
      name: "Kitchen",
      provider: "sonos--main",
      active_output_protocol: "airplay-kitchen",
      output_protocols: [
        outputProtocol({ output_protocol_id: "airplay-kitchen" }),
      ],
    },
    office: {
      player_id: "office",
      name: "Office",
      provider: "squeezelite--main",
      active_output_protocol: null,
      output_protocols: [],
    },
  };
}

function makeFormat(overrides: Partial<AudioFormat> = {}): AudioFormat {
  return audioFormat({ sample_rate: 48000, bit_depth: 16, ...overrides });
}
