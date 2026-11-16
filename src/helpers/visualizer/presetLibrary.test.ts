import { beforeEach, describe, expect, it, vi } from "vitest";

// the packs export the preset map itself, recognised by `baseVals`
vi.mock("butterchurn-presets", () => ({
  default: {
    "Alpha - one": { baseVals: { a: 1 } },
    "beta - two": { baseVals: { b: 2 } },
  },
}));
vi.mock("butterchurn-presets/dist/extra.min.js", () => ({
  default: { "Gamma - three": { baseVals: { c: 3 } } },
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

  it("returns presets by name", async () => {
    const { getPreset } = await import("./presetLibrary");
    expect(await getPreset("Gamma - three")).toEqual({ baseVals: { c: 3 } });
    expect(await getPreset("nope")).toBeUndefined();
  });

  it("returns a random preset name from the library", async () => {
    const { listPresetNames, randomPresetName } =
      await import("./presetLibrary");
    const names = await listPresetNames();
    expect(names).toContain(await randomPresetName());
  });

  it("keeps only favourites that are still in the library", async () => {
    const { availableFavorites } = await import("./presetLibrary");
    expect(
      availableFavorites(
        ["gone", "Alpha - one"],
        ["Alpha - one", "beta - two"],
      ),
    ).toEqual(["Alpha - one"]);
  });

  it("sorts favourites first, then alphabetically", async () => {
    const { sortFavoritesFirst } = await import("./presetLibrary");
    expect(
      sortFavoritesFirst(
        ["beta", "Gamma", "Alpha", "delta"],
        ["delta", "Gamma"],
      ),
    ).toEqual(["delta", "Gamma", "Alpha", "beta"]);
  });

  it("toggles a name in and out of the favourites", async () => {
    const { toggleFavoriteName } = await import("./presetLibrary");
    expect(toggleFavoriteName(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleFavoriteName(["a", "b"], "a")).toEqual(["b"]);
  });
});
