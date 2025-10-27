import { getImageThumbForItem } from "@/components/MediaItemThumb.vue";
import api from "@/plugins/api";
import {
  ImageType,
  MediaType,
  QueueItem,
  Track,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, watch } from "vue";

function playerMediaToMetadata(item: QueueItem) {
  let artist: string | undefined;
  let album: string | undefined;

  //here we cast to Track to access properties that are only available on Track
  if (item.media_item?.media_type === MediaType.TRACK) {
    const currentMedia = item.media_item as Track;
    artist = currentMedia.artists.map((a) => a.name).join(", ");
    album = currentMedia.album?.name;
  }
  const artwork = [
    {
      src: getImageThumbForItem(item, ImageType.THUMB, 128) || "",
      sizes: "128x128",
    },
    {
      src: getImageThumbForItem(item, ImageType.THUMB, 256) || "",
      sizes: "256x256",
    },
    {
      src: getImageThumbForItem(item, ImageType.THUMB, 512) || "",
      sizes: "512x512",
    },
  ];

  return new MediaMetadata({
    title: item.media_item!.name,
    artist,
    album,
    artwork: artwork,
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
  const queueItem = computed(() => {
    if (playerQueue.value && playerQueue.value.active)
      return playerQueue.value.current_item;
    return undefined;
  });
  let currentMediaUri: string | undefined;

  //watch the current media to update the metadata
  const unwatch_metadata = watch(
    () => queueItem.value,
    (newMedia) => {
      if (!newMedia || !newMedia.media_item) return;
      //Lets make sure that the new media isn't spammed
      if (newMedia.media_item.uri === currentMediaUri) return;
      const newMediaMetaData = playerMediaToMetadata(newMedia);
      currentMediaUri = newMedia.media_item.uri;
      navigator.mediaSession.metadata = newMediaMetaData;
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
        store.activePlayerQueue?.current_item?.media_item?.media_type !==
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
