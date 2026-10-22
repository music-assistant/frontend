/**
 * Lazy loader for the full butterchurn-presets library (base + extra packs).
 * The packs are multi-megabyte UMD bundles, so they are dynamically imported
 * once on first use and cached.
 */

type PresetMap = Record<string, object>;

interface PresetPack {
  getPresets: () => PresetMap;
}

let cache: PresetMap | null = null;
let loading: Promise<PresetMap> | null = null;

// The UMD packs may arrive plain, under `default`, or under `default.default`
// depending on the bundler's CJS interop; probe all nestings.
function packPresets(module: unknown): PresetMap {
  const record = module as Record<string, unknown>;
  const candidates = [
    module,
    record.default,
    (record.default as Record<string, unknown> | undefined)?.default,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof (candidate as PresetPack).getPresets === "function")
      return (candidate as PresetPack).getPresets();
  }
  return {};
}

/**
 * Load and merge all preset packs. Cached after the first call.
 */
export async function loadPresetLibrary(): Promise<PresetMap> {
  if (cache) return cache;
  loading ??= (async () => {
    const presets: PresetMap = {};
    const base: unknown = await import("butterchurn-presets");
    Object.assign(presets, packPresets(base));
    try {
      const extra: unknown =
        await import("butterchurn-presets/lib/butterchurnPresetsExtra.min.js");
      Object.assign(presets, packPresets(extra));
    } catch {
      // Extra pack is optional; the base pack alone is fine.
    }
    cache = presets;
    return presets;
  })();
  return loading;
}

export async function listPresetNames(): Promise<string[]> {
  const presets = await loadPresetLibrary();
  // Case-insensitive so the order is stable regardless of the runtime's
  // default collation (a TV's browser must match the desktop's).
  return Object.keys(presets).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export async function getPreset(name: string): Promise<object | undefined> {
  const presets = await loadPresetLibrary();
  return presets[name];
}

export async function randomPresetName(): Promise<string> {
  const names = await listPresetNames();
  // Empty only if the packs failed to load; return "" so callers fall back to
  // butterchurn's own default rather than propagating undefined.
  if (names.length === 0) return "";
  return names[Math.floor(Math.random() * names.length)];
}
