import {
  type AIEngine,
  AIEngineKind,
  type AIEngineUsage,
  ProviderFeature,
  ProviderType,
} from "@/plugins/api/interfaces";
import { House, Puzzle } from "@lucide/vue";
import { describe, expect, it, vi } from "vitest";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { aiServiceRows, engineSummary, engineUsageRows } from "./ai_settings";

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

  it("names the default engine a setting follows", () => {
    const [row] = engineUsageRows([setting()], [engine("gpt")], reconfigure);

    expect(row).toMatchObject({
      key: "smart_playlist--1/ai_engine",
      label: "Smart playlists",
      description: "settings.ai.kind.text",
      state: "settings.ai.follows_default(OpenAI | gpt)",
      error: false,
      to: { name: "editprovider", params: { instanceId: "smart_playlist--1" } },
    });
  });

  it("names the engine a setting picks itself", () => {
    const [row] = engineUsageRows(
      [setting({ follows_default: false })],
      [engine("gpt")],
      reconfigure,
    );

    expect(row.state).toBe("OpenAI | gpt");
  });

  it.each([
    ["selects no engine", null],
    ["selects an engine that is gone", "removed"],
  ])("reports a setting that %s", (_name, engineUid) => {
    const [row] = engineUsageRows(
      [setting({ engine: engineUid })],
      [engine("gpt")],
      reconfigure,
    );

    expect(row.state).toBe("settings.ai.not_available");
    expect(row.error).toBe(true);
  });

  it("describes the kind of engine of each setting", () => {
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

  it("starts the setup flow of a provider for a setting changed there", () => {
    const radio = setting({
      owner: "ai_radio--1",
      domain: "ai_radio",
      in_setup_data: true,
    });
    const [row] = engineUsageRows([radio], [engine("gpt")], reconfigure);

    expect(row.to).toBeUndefined();
    row.action?.();
    expect(reconfigure).toHaveBeenCalledExactlyOnceWith(radio);
  });

  it("names a core module after the page showing its setting and leads there", () => {
    const [row] = engineUsageRows(
      [
        setting({
          owner_type: "core",
          owner: "players",
          domain: "players",
          name: "Players",
          kind: AIEngineKind.SPEECH,
        }),
      ],
      [],
      reconfigure,
    );

    expect(row.label).toBe("settings.playback.title");
    expect(row.to).toEqual({ name: "playbacksettings" });
  });

  it("leads a core module no page shows to its own settings", () => {
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
    expect(row.to).toEqual({
      name: "editcore",
      params: { domain: "radio_tuner" },
    });
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
