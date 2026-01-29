import { getMediaImageUrl } from "@/helpers/utils";
import api from "@/plugins/api";
import { MediaType, PlayerMedia } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, watch } from "vue";

function playerMediaToMetadata(item: PlayerMedia) {
  const artwork = [
    {
      src: getMediaImageUrl(item.image_url),
    },
  ];

  return new MediaMetadata({
    title: item.title,
    artist: item.artist,
    album: item.album,
    artwork,
  });
}
// If no player_id is passed, the currently selected player is shown
export function useMediaBrowserMetaData(player_id?: string) {
  let player;
  if (player_id === undefined) {
    player = computed(() => {
      if (store.activePlayerId && store.activePlayerId in api.players) {
        return api.players[store.activePlayerId];
      }
      return undefined;
    });
  } else {
    player = computed(() => {
      if (player_id in api.players) {
        return api.players[player_id];
      }
      return undefined;
    });
  }

  const playerQueue = computed(() => {
    if (
      player.value?.active_source &&
      player.value.active_source in api.queues
    ) {
      return api.queues[player.value.active_source];
    }
    if (
      player.value &&
      !player.value.active_source &&
      player.value.player_id in api.queues &&
      api.queues[player.value.player_id].active
    ) {
      return api.queues[player.value.player_id];
    }
    return undefined;
  });

  const mediaMetadata = computed(() => {
    return player.value?.current_media
      ? playerMediaToMetadata(player.value?.current_media)
      : undefined;
  });

  let currentMediaMetadata: MediaMetadata | undefined;

  //watch the current media to update the metadata
  const unwatch_metadata = watch(
    () => mediaMetadata.value,
    (newMetadata) => {
      if (!newMetadata) return;
      //Lets make sure that the new media isn't spammed
      if (
        newMetadata.album === currentMediaMetadata?.album &&
        newMetadata.title === currentMediaMetadata?.title &&
        newMetadata.artist === currentMediaMetadata?.artist &&
        newMetadata.artwork === currentMediaMetadata?.artwork
      )
        return;
      navigator.mediaSession.metadata = newMetadata;
      currentMediaMetadata = newMetadata;
    },
    { immediate: true },
  );
  const unwatch_position = watch(
    () => [
      playerQueue.value?.elapsed_time,
      playerQueue.value?.current_item?.duration,
    ],
    () => {
      if (
        !playerQueue.value?.active ||
        playerQueue.value?.current_item?.media_item?.media_type !==
          MediaType.TRACK
      ) {
        // Clear the progress bar.
        navigator.mediaSession.setPositionState();
        return;
      }
      const duration = playerQueue.value?.current_item?.duration || 1;
      const position = Math.min(
        duration,
        playerQueue.value?.elapsed_time != null
          ? playerQueue.value?.elapsed_time
          : 0,
      );
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1.0,
        position: position,
      });
    },
    { immediate: true },
  );
  return () => {
    unwatch_metadata();
    unwatch_position();
  };
}
