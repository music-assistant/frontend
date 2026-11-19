import {
  ProviderFeature,
  ProviderOffering,
  ProviderType,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import { getFilterLabels, getProviderLabels } from "./provider_labels";

describe("what a provider offers", () => {
  it("labels a music source with what it offers as a source", () => {
    const manifest = providerManifest({
      provides: [ProviderOffering.TRACK],
    });
    const instance = providerInstance({
      supported_features: [ProviderFeature.LIBRARY_PODCASTS],
    });

    expect(getProviderLabels(manifest)).toEqual(["library"]);
    expect(getProviderLabels(manifest, instance)).toEqual([
      "library",
      "podcasts",
    ]);
  });

  it("labels a plugin playing audio into Music Assistant as a live source", () => {
    const manifest = providerManifest({
      type: ProviderType.PLUGIN,
      provides: [ProviderOffering.AUDIO_SOURCE, ProviderOffering.AI],
    });

    expect(getProviderLabels(manifest)).toEqual(["live"]);
  });

  it("labels any other plugin with what it delivers", () => {
    expect(
      getProviderLabels(
        providerManifest({
          type: ProviderType.PLUGIN,
          provides: [ProviderOffering.SCROBBLE],
        }),
      ),
    ).toEqual(["scrobble"]);
    expect(
      getProviderLabels(providerManifest({ type: ProviderType.PLUGIN })),
    ).toEqual(["other"]);
  });

  it.each([
    ProviderType.PLAYER,
    ProviderType.METADATA,
    ProviderType.AUDIO_ANALYSIS,
  ])("gives a %s provider no labels", (type) => {
    // the Sendspin player provider declares audio sources for its line-ins
    expect(
      getProviderLabels(
        providerManifest({ type, provides: [ProviderOffering.AUDIO_SOURCE] }),
      ),
    ).toEqual([]);
  });

  it("gives no labels without a manifest", () => {
    expect(getProviderLabels(undefined, providerInstance())).toEqual([]);
  });
});

describe("the labels to filter a list on", () => {
  it("are those at least one provider has, in the order the labels show", () => {
    expect(
      getFilterLabels([["live"], ["podcasts"], [], ["library", "podcasts"]]),
    ).toEqual(["library", "podcasts", "live"]);
    expect(getFilterLabels([["other"], ["fun", "ai"], ["tts"]])).toEqual([
      "ai",
      "tts",
      "fun",
      "other",
    ]);
  });

  it("are none while fewer than two labels occur", () => {
    expect(getFilterLabels([["live"], ["live"], []])).toEqual([]);
    expect(getFilterLabels([["other"], ["other"]])).toEqual([]);
    expect(getFilterLabels([[], []])).toEqual([]);
    expect(getFilterLabels([])).toEqual([]);
  });
});
