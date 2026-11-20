import {
  type AIEngine,
  AIEngineKind,
  type AIEngineUsage,
  ProviderFeature,
  ProviderType,
} from "@/plugins/api/interfaces";
import { House, MessageSquareText, Puzzle } from "@lucide/vue";
import { describe, expect, it, vi } from "vitest";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import {
  aiServiceRows,
  engineSettingOwner,
  engineSettingState,
  engineSummary,
  engineUsageRows,
  hasEnginePicker,
  selectsAvailableEngine,
  withRestartingSettings,
} from "./ai_settings";

// the key, with the values it is given in brackets
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, ...args: unknown[]) => {
    const options = args.find((arg) => typeof arg === "object") as
      Record<string, unknown> | undefined;
    const values = (options?.named ?? options) as
      Record<string, unknown> | undefined;
    return values ? `${key}(${Object.values(values).join()})` : key;
  },
}));

function engine(
  uid: string,
  kind: AIEngineKind = AIEngineKind.TEXT,
  provider = "openai_compatible--1",
): AIEngine {
  return { uid, name: `OpenAI | ${uid}`, kind, provider };
}

function setting(overrides: Partial<AIEngineUsage> = {}): AIEngineUsage {
  return {
    owner_type: "provider",
    owner: "smart_playlist--1",
    domain: "smart_playlist",
    name: "Smart playlists",
    key: "ai_engine",
    kind: AIEngineKind.TEXT,
    in_setup_data: false,
    follows_default: true,
    engine: "gpt",
    ...overrides,
  };
}

function aiPlugin(domain: string, name: string, instanceId = `${domain}--1`) {
  return providerInstance({
    type: ProviderType.PLUGIN,
    domain,
    name,
    instance_id: instanceId,
    supported_features: [ProviderFeature.AI_QUERY],
  });
}

describe("engineSummary", () => {
  it("counts the engines of each kind, text first and image last", () => {
    expect(
      engineSummary([
        engine("dall-e", AIEngineKind.IMAGE),
        engine("gpt"),
        engine("claude"),
        engine("voice", AIEngineKind.SPEECH),
      ]),
    ).toBe(
      "settings.ai.engine_count.text(2) · settings.ai.engine_count.speech(1) · settings.ai.engine_count.image(1)",
    );
  });

  it("leaves out the kinds there are no engines of", () => {
    expect(engineSummary([engine("gpt")])).toBe(
      "settings.ai.engine_count.text(1)",
    );
  });

  it("is empty without engines", () => {
    expect(engineSummary([])).toBe("");
  });
});

describe("engineUsageRows", () => {
  const reconfigure = vi.fn();

  it("leaves the engine of a setting to the picker on its row", () => {
    const [row] = engineUsageRows([setting()], [engine("gpt")], reconfigure);

    expect(row).toEqual({
      key: "smart_playlist--1/ai_engine",
      icon: MessageSquareText,
      label: "Smart playlists",
      // the picker names the kind of engine
      description: "",
    });
  });

  it.each([
    ["selects no engine", null],
    ["selects an engine that is gone", "removed"],
  ])("leaves a setting that %s to its picker to report", (_name, engineUid) => {
    const [row] = engineUsageRows(
      [setting({ engine: engineUid })],
      [engine("gpt")],
      reconfigure,
    );

    expect(row.description).toBe("");
    expect(row.error).toBeUndefined();
  });

  it("calmly says no engine of its kind is available", () => {
    const [row] = engineUsageRows(
      [setting({ kind: AIEngineKind.IMAGE, engine: null })],
      [engine("gpt")],
      reconfigure,
    );

    expect(row).toMatchObject({
      description: "settings.ai.kind.image",
      state: "settings.ai.not_available",
    });
    expect(row.error).toBeUndefined();
  });

  it("describes the kind of engine of a setting without a picker", () => {
    const rows = engineUsageRows(
      [
        setting({ key: "image_engine", kind: AIEngineKind.IMAGE }),
        setting({ key: "tts_engine", kind: AIEngineKind.SPEECH }),
      ],
      [],
      reconfigure,
    );

    expect(rows.map((row) => row.description)).toEqual([
      "settings.ai.kind.image",
      "settings.ai.kind.speech",
    ]);
  });

  describe("a setting changed in the setup of its provider", () => {
    const radio = setting({
      owner: "ai_radio--1",
      domain: "ai_radio",
      name: "AI Radio",
      in_setup_data: true,
    });

    it("names the engine and starts that setup", () => {
      const [row] = engineUsageRows([radio], [engine("gpt")], reconfigure);

      expect(row).toMatchObject({
        description: "settings.ai.kind.text",
        state: "settings.ai.follows_default(OpenAI | gpt)",
        error: false,
      });
      expect(row.to).toBeUndefined();
      row.action?.();
      expect(reconfigure).toHaveBeenCalledExactlyOnceWith(radio);
    });

    it("reports an engine that is gone", () => {
      const [row] = engineUsageRows(
        [{ ...radio, engine: "removed" }],
        [engine("gpt")],
        reconfigure,
      );

      expect(row.state).toBe("settings.ai.not_available");
      expect(row.error).toBe(true);
    });

    it("still starts the setup without engines of its kind", () => {
      const [row] = engineUsageRows([radio], [], reconfigure);

      expect(row.state).toBe("settings.ai.not_available");
      expect(row.error).toBeUndefined();
      expect(row.action).toBeDefined();
    });
  });

  it("names a core module after the page showing its setting", () => {
    const [row] = engineUsageRows(
      [
        setting({
          owner_type: "core",
          owner: "players",
          domain: "players",
          name: "Players",
          kind: AIEngineKind.SPEECH,
          engine: "nova",
        }),
      ],
      [engine("nova", AIEngineKind.SPEECH)],
      reconfigure,
    );

    expect(row.label).toBe("settings.playback.title");
    expect(row.to).toBeUndefined();
  });

  it("names a core module no page shows by its own name", () => {
    const [row] = engineUsageRows(
      [
        setting({
          owner_type: "core",
          owner: "radio_tuner",
          domain: "radio_tuner",
          name: "Radio tuner",
        }),
      ],
      [],
      reconfigure,
    );

    expect(row.label).toBe("Radio tuner");
  });
});

describe("hasEnginePicker", () => {
  it("picks the engine of a setting on its row", () => {
    expect(hasEnginePicker(setting(), [engine("gpt")])).toBe(true);
  });

  it("leaves a setting of the setup of its provider to that setup", () => {
    expect(
      hasEnginePicker(setting({ in_setup_data: true }), [engine("gpt")]),
    ).toBe(false);
  });

  it("has nothing to pick without engines of its kind", () => {
    expect(
      hasEnginePicker(setting({ kind: AIEngineKind.SPEECH }), [engine("gpt")]),
    ).toBe(false);
  });
});

describe("selectsAvailableEngine", () => {
  it("finds the engine a setting selects among the available ones", () => {
    expect(selectsAvailableEngine(setting(), [engine("gpt")])).toBe(true);
  });

  it.each([
    ["no engine", null],
    ["an engine that is gone", "removed"],
  ])("is false for a setting that selects %s", (_name, engineUid) => {
    expect(
      selectsAvailableEngine(setting({ engine: engineUid }), [engine("gpt")]),
    ).toBe(false);
  });
});

describe("engineSettingState", () => {
  it.each([
    [
      "the default engine it follows",
      {},
      "settings.ai.follows_default(OpenAI | gpt)",
    ],
    ["the engine it picks", { follows_default: false }, "OpenAI | gpt"],
    [
      "that its engine is gone",
      { engine: "removed" },
      "settings.ai.not_available",
    ],
  ])("names %s", (_name, overrides, state) => {
    expect(engineSettingState(setting(overrides), [engine("gpt")])).toBe(state);
  });
});

describe("engineSettingOwner", () => {
  it("stores the setting of a core module in that module", () => {
    expect(
      engineSettingOwner(
        setting({ owner_type: "core", owner: "players", domain: "players" }),
      ),
    ).toEqual({ kind: "core", domain: "players" });
  });

  it("stores the setting of a provider in its instance", () => {
    expect(engineSettingOwner(setting())).toEqual({
      kind: "provider",
      domain: "smart_playlist",
      instanceId: "smart_playlist--1",
    });
  });
});

describe("withRestartingSettings", () => {
  const players = setting({
    owner_type: "core",
    owner: "players",
    domain: "players",
    name: "Players",
  });
  const quiz = setting({ owner: "music_quiz--1", name: "Music Quiz" });
  const smart = setting({
    owner: "smart_playlist--1",
    name: "smart playlists",
  });
  const radio = setting({ owner: "ai_radio--1", name: "AI Radio" });

  it("lists the current settings", () => {
    expect(
      withRestartingSettings([players, quiz], [players, smart], new Set()),
    ).toEqual([players, quiz]);
  });

  it("keeps the settings of a restarting provider in their place", () => {
    expect(
      withRestartingSettings(
        [players, radio, smart],
        [players, radio, quiz, smart],
        new Set(["music_quiz--1"]),
      ),
    ).toEqual([players, radio, quiz, smart]);
  });

  it("lists a restarting provider that is back as the server has it", () => {
    const listedAgain = { ...quiz, follows_default: false };

    expect(
      withRestartingSettings(
        [players, listedAgain],
        [players, quiz],
        new Set(["music_quiz--1"]),
      ),
    ).toEqual([players, listedAgain]);
  });
});

describe("aiServiceRows", () => {
  it("lists the running plugins providing engines, by name", () => {
    const rows = aiServiceRows(
      [
        aiPlugin("openai_compatible", "OpenAI"),
        providerInstance({ type: ProviderType.PLUGIN, domain: "party" }),
        aiPlugin("openai_tts", "Kitchen voices"),
      ],
      [
        engine("gpt"),
        engine("dall-e", AIEngineKind.IMAGE),
        engine("nova", AIEngineKind.SPEECH, "openai_tts--1"),
      ],
    );

    expect(rows.map((row) => row.label)).toEqual(["Kitchen voices", "OpenAI"]);
    expect(rows[1]).toMatchObject({
      key: "openai_compatible--1",
      icon: Puzzle,
      description:
        "settings.ai.engine_count.text(1) · settings.ai.engine_count.image(1)",
      error: false,
      to: {
        name: "editprovider",
        params: { instanceId: "openai_compatible--1" },
      },
    });
  });

  it("asks for the models of a plugin that provides no engines yet", () => {
    const [row] = aiServiceRows([aiPlugin("openai_compatible", "OpenAI")], []);

    expect(row.description).toBe("settings.ai.choose_models");
    expect(row.error).toBe(true);
  });

  it("leads Home Assistant to its own page", () => {
    const [row] = aiServiceRows(
      [aiPlugin("hass", "Home Assistant", "hass")],
      [engine("ai_task.openai", AIEngineKind.TEXT, "hass")],
    );

    expect(row.icon).toBe(House);
    expect(row.to).toEqual({ name: "homeassistantsettings" });
  });
});
