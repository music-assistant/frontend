import { ProviderOffering, ProviderType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import { getPluginLabels } from "./plugin_labels";

const plugin = (provides: ProviderOffering[]) =>
  providerManifest({ type: ProviderType.PLUGIN, provides });

describe("what a plugin delivers", () => {
  it.each([
    [ProviderOffering.AI, "ai"],
    [ProviderOffering.TTS, "tts"],
    [ProviderOffering.SCROBBLE, "scrobble"],
    [ProviderOffering.ASSISTANT, "assistant"],
    [ProviderOffering.VISUALIZER, "visualizer"],
    [ProviderOffering.RECOMMENDATIONS, "recommendations"],
    [ProviderOffering.FUN, "fun"],
  ])(
    "labels a plugin whose manifest provides %s with %s",
    (offering, label) => {
      expect(getPluginLabels(plugin([offering]))).toEqual([label]);
    },
  );

  it("gives each label once, in the order the labels show", () => {
    expect(
      getPluginLabels(
        plugin([
          ProviderOffering.FUN,
          ProviderOffering.AI,
          ProviderOffering.FUN,
          ProviderOffering.SCROBBLE,
        ]),
      ),
    ).toEqual(["ai", "scrobble", "fun"]);
  });

  it("labels a plugin from a server that sends no offerings as other", () => {
    const manifest = providerManifest({ type: ProviderType.PLUGIN });
    delete manifest.provides;
    expect(getPluginLabels(manifest)).toEqual(["other"]);
  });

  it("labels a plugin that provides nothing as other", () => {
    expect(getPluginLabels(plugin([]))).toEqual(["other"]);
  });

  it("labels a plugin as other when it provides nothing a plugin label names", () => {
    expect(getPluginLabels(plugin([ProviderOffering.UNKNOWN]))).toEqual([
      "other",
    ]);
    expect(getPluginLabels(plugin([ProviderOffering.TRACK]))).toEqual([
      "other",
    ]);
  });

  it("does not add other to a plugin with a label", () => {
    expect(
      getPluginLabels(plugin([ProviderOffering.UNKNOWN, ProviderOffering.TTS])),
    ).toEqual(["tts"]);
  });
});
