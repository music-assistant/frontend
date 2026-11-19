import {
  type AIEngine,
  AIEngineKind,
  ProviderFeature,
  ProviderType,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { enginesOf, providesAIEngines } from "./ai_engines";

function engine(uid: string, provider: string): AIEngine {
  return { uid, name: uid, kind: AIEngineKind.TEXT, provider };
}

describe("providesAIEngines", () => {
  it.each([ProviderFeature.AI_QUERY, ProviderFeature.TTS])(
    "counts a running plugin with the %s feature",
    (feature) => {
      expect(
        providesAIEngines(
          providerInstance({
            type: ProviderType.PLUGIN,
            supported_features: [feature],
          }),
        ),
      ).toBe(true);
    },
  );

  it("leaves out a plugin without either feature", () => {
    expect(
      providesAIEngines(
        providerInstance({
          type: ProviderType.PLUGIN,
          supported_features: [ProviderFeature.AUDIO_SOURCE],
        }),
      ),
    ).toBe(false);
  });

  it("leaves out a plugin that is not available", () => {
    expect(
      providesAIEngines(
        providerInstance({
          type: ProviderType.PLUGIN,
          supported_features: [ProviderFeature.AI_QUERY],
          available: false,
        }),
      ),
    ).toBe(false);
  });

  it("leaves out any other type of provider", () => {
    expect(
      providesAIEngines(
        providerInstance({
          type: ProviderType.MUSIC,
          supported_features: [ProviderFeature.AI_QUERY],
        }),
      ),
    ).toBe(false);
  });
});

describe("enginesOf", () => {
  it("gives the engines of one plugin instance", () => {
    const engines = [
      engine("a", "openai--1"),
      engine("b", "hass"),
      engine("c", "openai--1"),
    ];

    expect(enginesOf(engines, "openai--1").map(({ uid }) => uid)).toEqual([
      "a",
      "c",
    ]);
    expect(enginesOf(engines, "openai--2")).toEqual([]);
  });
});
