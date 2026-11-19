import { ProviderOffering, ProviderType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import {
  getFilterLabels,
  getProviderLabels,
  isProviderLabel,
} from "./provider_labels";

describe("what a provider offers", () => {
  it("labels a music source with what it offers as a source", () => {
    expect(
      getProviderLabels(
        providerManifest({
          provides: [ProviderOffering.TRACK, ProviderOffering.PODCAST],
        }),
      ),
    ).toEqual(["library", "podcasts"]);
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
    expect(getProviderLabels(undefined)).toEqual([]);
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

describe("whether a value is a label", () => {
  it.each(["library", "live", "ai", "tts", "other"])("is for %s", (value) => {
    expect(isProviderLabel(value)).toBe(true);
  });

  it.each(["bogus", "", null, undefined, ["ai"]])("is not for %o", (value) => {
    expect(isProviderLabel(value)).toBe(false);
  });
});
