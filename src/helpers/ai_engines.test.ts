import {
  type AIEngine,
  AIEngineKind,
  ProviderFeature,
  ProviderOffering,
  ProviderType,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import { enginesOf, isAIService, providesAIEngines } from "./ai_engines";

function engine(uid: string, provider: string): AIEngine {
  return { uid, name: uid, kind: AIEngineKind.TEXT, provider };
}

describe("isAIService", () => {
  const openAI = providerManifest({
    type: ProviderType.PLUGIN,
    provides: [ProviderOffering.AI],
  });
  const homeAssistant = providerManifest({ type: ProviderType.PLUGIN });

  it("counts a plugin that brings AI or speech, running or not", () => {
    expect(isAIService(openAI)).toBe(true);
    expect(
      isAIService(
        openAI,
        providerInstance({ type: ProviderType.PLUGIN, available: false }),
      ),
    ).toBe(true);
  });

  it("counts another plugin only while it provides engines", () => {
    expect(
      isAIService(
        homeAssistant,
        providerInstance({
          type: ProviderType.PLUGIN,
          supported_features: [ProviderFeature.TTS],
        }),
      ),
    ).toBe(true);
    expect(
      isAIService(
        homeAssistant,
        providerInstance({ type: ProviderType.PLUGIN, supported_features: [] }),
      ),
    ).toBe(false);
    expect(isAIService(homeAssistant)).toBe(false);
  });
});

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
