import { computed } from "vue";
import { resolveExternalSource } from "@/composables/externalSource";
import { getSourceLabel } from "@/helpers/players";
import { sourceProviderId } from "@/helpers/provider_domain";
import { store } from "@/plugins/store";

/**
 * The active external source, ready for display.
 */
export interface NowPlayingSource {
  name: string;
  /** Provider domain or instance id to render the source icon from. */
  iconDomain?: string;
  /** The source's name with the protocol it plays on, e.g. "YouTube • Chromecast". */
  label: string;
}

/**
 * Composable that exposes the external source active on the current player.
 */
export function useNowPlayingSource() {
  const activeSource = computed((): NowPlayingSource | undefined => {
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
      label: getSourceLabel(player, externalSource),
    };
  });

  // an external source that reports no track lands its own name in the title
  // slot, which would then read twice with the badge below it
  const nowPlayingSource = computed(() =>
    activeSource.value?.name === store.activePlayer?.current_media?.title
      ? undefined
      : activeSource.value,
  );

  // an external source with no real album lands its own name in the album slot
  const albumSubtitle = computed(() => {
    const album = store.activePlayer?.current_media?.album;
    if (!album || album === activeSource.value?.name) return "";
    return album;
  });

  return { nowPlayingSource, albumSubtitle };
}
