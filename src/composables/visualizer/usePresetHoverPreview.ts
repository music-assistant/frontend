/**
 * Hover-intent state for the preset hover preview: which preset to show and
 * where to anchor the floating panel. Hover-capable (desktop) pointers only,
 * and pointless without WebGL2. A short dwell before showing keeps the
 * preview engine from thrashing while the pointer travels across a list.
 */

import { onBeforeUnmount, ref } from "vue";
import { isVisualizerSupported } from "./useVisualizerEngine";

export interface PreviewAnchor {
  /** Bounding rect of the hovered list item (vertical alignment). */
  item: DOMRect;
  /** Bounding rect of the list itself (horizontal placement). */
  list: DOMRect;
}

const HOVER_DELAY_MS = 200;

export function usePresetHoverPreview(listSelector: string) {
  const supported =
    isVisualizerSupported() &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const previewPreset = ref<string | null>(null);
  const previewAnchor = ref<PreviewAnchor | null>(null);
  let hoverTimer: number | null = null;

  const onPresetHover = (name: string, event: PointerEvent) => {
    if (!supported) return;
    const item = event.currentTarget as HTMLElement;
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      hoverTimer = null;
      const list = item.closest(listSelector) ?? item;
      previewAnchor.value = {
        item: item.getBoundingClientRect(),
        list: list.getBoundingClientRect(),
      };
      previewPreset.value = name;
    }, HOVER_DELAY_MS);
  };

  const clearPreview = () => {
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    hoverTimer = null;
    previewPreset.value = null;
  };

  onBeforeUnmount(clearPreview);

  return { previewPreset, previewAnchor, onPresetHover, clearPreview };
}
