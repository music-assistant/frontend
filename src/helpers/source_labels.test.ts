import { ProviderOffering, ProviderType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import { getSourceLabels } from "./source_labels";

describe("what a source offers", () => {
  it.each([
    [ProviderOffering.ARTIST, "library"],
    [ProviderOffering.ALBUM, "library"],
    [ProviderOffering.TRACK, "library"],
    [ProviderOffering.PLAYLIST, "library"],
    [ProviderOffering.RADIO, "radio"],
    [ProviderOffering.PODCAST, "podcasts"],
    [ProviderOffering.AUDIOBOOK, "audiobooks"],
  ])("labels a source whose manifest names %s with %s", (mediaType, label) => {
    expect(
      getSourceLabels(providerManifest({ provides: [mediaType] })),
    ).toEqual([label]);
  });

  it("gives each label once, in the order the labels show", () => {
    expect(
      getSourceLabels(
        providerManifest({
          provides: [
            ProviderOffering.AUDIOBOOK,
            ProviderOffering.TRACK,
            ProviderOffering.PODCAST,
            ProviderOffering.ALBUM,
          ],
        }),
      ),
    ).toEqual(["library", "podcasts", "audiobooks"]);
  });

  it("gives no labels when nothing says what a source offers", () => {
    expect(getSourceLabels(providerManifest())).toEqual([]);
    expect(getSourceLabels(undefined)).toEqual([]);
  });

  it("labels a plugin declaring audio sources in its manifest as a live source only", () => {
    const manifest = providerManifest({
      type: ProviderType.PLUGIN,
      provides: [ProviderOffering.AUDIO_SOURCE],
    });

    expect(getSourceLabels(manifest)).toEqual(["live"]);
  });

  it("gives the Sendspin player provider, which declares audio sources for its line-ins, no live label", () => {
    const manifest = providerManifest({
      domain: "sendspin",
      type: ProviderType.PLAYER,
      provides: [ProviderOffering.AUDIO_SOURCE],
    });

    expect(getSourceLabels(manifest)).toEqual([]);
  });
});
