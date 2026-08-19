import { computed } from "vue";
import {
  MediaType,
  type PlayableMediaItemType,
} from "@/plugins/api/interfaces";
import { getSourceName, isAudioSource } from "@/plugins/api/helpers";
import { store } from "@/plugins/store";

/**
 * The source the active player is playing from, ready for display.
 */
export interface NowPlayingSource {
  name: string;
  /** Provider domain or instance id to render the source icon from. */
  iconDomain?: string;
}

/**
 * Composable that exposes the source producing the audio on the active player,
 * or undefined when the media on screen already names itself.
 *
 * Live sources publish the track they are currently streaming as the player's
 * media, so the title and artist on screen describe the audio but never its
 * origin: a plugin source (Spotify Connect, AirPlay, …), a radio station once
 * live stream metadata takes over its title, or a source outside Music
 * Assistant that took the player over.
 */
export function useNowPlayingSource() {
  const nowPlayingSource = computed((): NowPlayingSource | undefined => {
    const player = store.activePlayer;
    if (!player || player.powered === false) return undefined;

    const queueItem = store.curQueueItem;
    const mediaItem = queueItem?.media_item;

    // a plugin source is itself the queue item; the player's media carries
    // whatever that source happens to be streaming
    if (isAudioSource(mediaItem)) {
      return { name: mediaItem.name, iconDomain: iconDomain(mediaItem) };
    }

    // a station only loses its name to the running track once it sends stream
    // metadata; without it the title already is the station
    if (
      mediaItem?.media_type === MediaType.RADIO &&
      queueItem?.streamdetails?.stream_metadata
    ) {
      return { name: mediaItem.name, iconDomain: iconDomain(mediaItem) };
    }

    // the player left Music Assistant altogether, so there is no queue item to
    // read the source from and its name comes from the player's source list
    if (!store.activePlayerQueue && player.active_source) {
      return { name: getSourceName(player) };
    }

    return undefined;
  });

  // a live source with no real album lands its own name in the album slot, so
  // the album line is blanked wherever the badge already states it
  const albumSubtitle = computed(() => {
    const album = store.activePlayer?.current_media?.album;
    if (!album || album === nowPlayingSource.value?.name) return "";
    return album;
  });

  return { nowPlayingSource, albumSubtitle };
}

// the provider behind the source rather than the library: a station saved to
// the library still streams from the provider that identifies it
function iconDomain(item: PlayableMediaItemType): string {
  if (item.provider_mappings.length) {
    return item.provider_mappings[0].provider_domain;
  }
  return item.provider;
}
