import { AudioLines } from "@lucide/vue";
import type { Component } from "vue";

// the server lists the live sources under this browse scheme: live_sources://
export const LIVE_SOURCES_BROWSE_SCHEME = "live_sources";

// browse schemes whose folders stand for something other than a provider
const BROWSE_SCHEME_ICONS: Record<string, Component> = {
  [LIVE_SOURCES_BROWSE_SCHEME]: AudioLines,
};

/**
 * The icon of a browse folder that stands for a browse scheme of its own.
 *
 * @param path - The browse path of the folder, e.g. `live_sources://`.
 * @returns undefined for a folder of an ordinary provider.
 */
export function getBrowseFolderIcon(path?: string): Component | undefined {
  const separatorIndex = path?.indexOf("://") ?? -1;
  if (!path || separatorIndex < 0) return undefined;
  return BROWSE_SCHEME_ICONS[path.slice(0, separatorIndex)];
}
