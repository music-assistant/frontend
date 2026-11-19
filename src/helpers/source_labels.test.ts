import {
  ProviderOffering,
  ProviderFeature,
  ProviderType,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerInstance } from "../../tests/fixtures/providerInstance";
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

  it("labels a source by the media types its manifest names, running or not", () => {
    // a radio catalogue offers radio without a radio library
    const manifest = providerManifest({ provides: [ProviderOffering.RADIO] });
    const instance = providerInstance({
      supported_features: [ProviderFeature.SEARCH, ProviderFeature.BROWSE],
    });

    expect(getSourceLabels(manifest)).toEqual(["radio"]);
    expect(getSourceLabels(manifest, instance)).toEqual(["radio"]);
  });

  it("adds what a running source reports on top of its manifest's media types", () => {
    // audiobooks the account turns on are no media type the manifest names
    const manifest = providerManifest({
      provides: [ProviderOffering.TRACK, ProviderOffering.PODCAST],
    });
    const instance = providerInstance({
      supported_features: [ProviderFeature.LIBRARY_AUDIOBOOKS],
    });

    expect(getSourceLabels(manifest)).toEqual(["library", "podcasts"]);
    expect(getSourceLabels(manifest, instance)).toEqual([
      "library",
      "podcasts",
      "audiobooks",
    ]);
  });

  it.each([
    [ProviderFeature.LIBRARY_ARTISTS, "library"],
    [ProviderFeature.LIBRARY_ALBUMS, "library"],
    [ProviderFeature.LIBRARY_TRACKS, "library"],
    [ProviderFeature.LIBRARY_PLAYLISTS, "library"],
    [ProviderFeature.LIBRARY_RADIOS, "radio"],
    [ProviderFeature.LIBRARY_PODCASTS, "podcasts"],
    [ProviderFeature.LIBRARY_AUDIOBOOKS, "audiobooks"],
  ])(
    "labels a source reporting %s with %s while its manifest names no media types",
    (feature, label) => {
      expect(
        getSourceLabels(
          providerManifest(),
          providerInstance({ supported_features: [feature] }),
        ),
      ).toEqual([label]);
    },
  );

  it("gives each label once, in the order the labels show", () => {
    const instance = providerInstance({
      supported_features: [
        ProviderFeature.LIBRARY_AUDIOBOOKS,
        ProviderFeature.LIBRARY_TRACKS,
        ProviderFeature.SEARCH,
        ProviderFeature.LIBRARY_PODCASTS,
        ProviderFeature.LIBRARY_ALBUMS,
      ],
    });

    expect(getSourceLabels(providerManifest(), instance)).toEqual([
      "library",
      "podcasts",
      "audiobooks",
    ]);
  });

  it("gives a source whose manifest names no media types no labels while it is not running", () => {
    const manifest = providerManifest();
    const instance = providerInstance({
      supported_features: [ProviderFeature.LIBRARY_PODCASTS],
    });

    expect(getSourceLabels(manifest, instance)).toEqual(["podcasts"]);
    expect(getSourceLabels(manifest)).toEqual([]);
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
    // a running one reports its features without it, the manifest still decides
    expect(getSourceLabels(manifest, providerInstance())).toEqual(["live"]);
  });

  it("does not take a live source from what a running instance reports", () => {
    const instance = providerInstance({
      type: ProviderType.PLUGIN,
      supported_features: [ProviderFeature.AUDIO_SOURCE],
    });

    expect(
      getSourceLabels(
        providerManifest({ type: ProviderType.PLUGIN }),
        instance,
      ),
    ).toEqual([]);
  });

  it("gives the Sendspin player provider, which declares audio sources for its line-ins, no live label", () => {
    const manifest = providerManifest({
      domain: "sendspin",
      type: ProviderType.PLAYER,
      provides: [ProviderOffering.AUDIO_SOURCE],
    });
    const instance = providerInstance({
      domain: "sendspin",
      type: ProviderType.PLAYER,
      supported_features: [ProviderFeature.AUDIO_SOURCE],
    });

    expect(getSourceLabels(manifest)).toEqual([]);
    expect(getSourceLabels(manifest, instance)).toEqual([]);
  });
});
