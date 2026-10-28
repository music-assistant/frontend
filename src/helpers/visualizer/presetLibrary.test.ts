import { beforeEach, describe, expect, it, vi } from "vitest";

// getPresets is declared (as undefined) at the top level so the loader's
// shape-probing can touch it without vitest's strict namespace throwing.
vi.mock("butterchurn-presets", () => ({
  getPresets: undefined,
  default: {
    getPresets: () => ({ "Alpha - one": { a: 1 }, "beta - two": { b: 2 } }),
  },
}));
vi.mock("butterchurn-presets/lib/butterchurnPresetsExtra.min.js", () => ({
  getPresets: undefined,
  default: { getPresets: () => ({ "Gamma - three": { c: 3 } }) },
}));

describe("presetLibrary", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("merges base and extra packs, sorted case-insensitively", async () => {
    const { listPresetNames } = await import("./presetLibrary");
    // "beta" between "Alpha" and "Gamma" only holds under case-insensitive
    // ordering; a case-sensitive sort would put both capitalised names first.
    expect(await listPresetNames()).toEqual([
      "Alpha - one",
      "beta - two",
      "Gamma - three",
    ]);
  });

  it("retries a failed base pack load without reusing its rejected promise", async () => {
    const getPresets = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("temporary load failure");
      })
      .mockReturnValue({ "Recovered preset": {} });
    vi.doMock("butterchurn-presets", () => ({
      getPresets,
      default: undefined,
    }));
    try {
      const { loadPresetLibrary } = await import("./presetLibrary");
      const first = loadPresetLibrary();
      const concurrent = loadPresetLibrary();
      await expect(first).rejects.toThrow("temporary load failure");
      await expect(concurrent).rejects.toThrow("temporary load failure");
      expect(getPresets).toHaveBeenCalledTimes(1);
      await expect(loadPresetLibrary()).resolves.toHaveProperty(
        "Recovered preset",
      );
      expect(getPresets).toHaveBeenCalledTimes(2);
    } finally {
      vi.doUnmock("butterchurn-presets");
    }
  });

  it("returns presets by name", async () => {
    const { getPreset } = await import("./presetLibrary");
    expect(await getPreset("Gamma - three")).toEqual({ c: 3 });
    expect(await getPreset("nope")).toBeUndefined();
  });

  it("returns a random preset name from the library", async () => {
    const { listPresetNames, randomPresetName } =
      await import("./presetLibrary");
    const names = await listPresetNames();
    expect(names).toContain(await randomPresetName());
  });
});
