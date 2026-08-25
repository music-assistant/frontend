import { computed } from "vue";
import { resolveExternalSource } from "@/composables/externalSource";
import { store } from "@/plugins/store";

/**
 * The active external source, ready for display.
 */
export interface NowPlayingSource {
  name: string;
  /** Provider domain or instance id to render the source icon from. */
  iconDomain?: string;
}

/**
 * Composable that exposes the external source active on the current player.
 */
export function useNowPlayingSource() {
  const nowPlayingSource = computed((): NowPlayingSource | undefined => {
    const player = store.activePlayer;
    if (!player || player.powered === false) return undefined;

    const externalSource = resolveExternalSource(
      player,
      store.activePlayerQueue,
    );
    if (!externalSource) return undefined;
    return {
      name: externalSource.name,
      iconDomain: sourceProviderId(externalSource.id),
    };
  });

  // an external source with no real album lands its own name in the album slot
  const albumSubtitle = computed(() => {
    const album = store.activePlayer?.current_media?.album;
    if (!album || album === nowPlayingSource.value?.name) return "";
    return album;
  });

  return { nowPlayingSource, albumSubtitle };
}

/** Provider domain/instance id prefix of a source id, e.g. "spotify" from "spotify://...". */
export function sourceProviderId(sourceId: string): string | undefined {
  const separator = sourceId.indexOf("://");
  return separator > 0 ? sourceId.slice(0, separator) : undefined;
}
