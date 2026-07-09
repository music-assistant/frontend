import { getMediaImageUrl } from "@/helpers/utils";
import api from "@/plugins/api";
import { MediaType, PlayerMedia } from "@/plugins/api/interfaces";
import authManager from "@/plugins/auth";
import { store } from "@/plugins/store";
import { computed, watch } from "vue";
import { useRouter } from "vue-router";

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

function genericQuizMetadata() {
  return new MediaMetadata({
    title: "Music Quiz",
    artist: "",
    album: "",
    artwork: [],
  });
}

// If no player_id is passed, the currently selected player is shown
export function useMediaBrowserMetaData(player_id?: string) {
  const router = useRouter();

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

  const shouldSuppressMetadata = computed(() => {
    // Suppress track metadata for music quiz guests during an active round
    // to prevent answer leaks via OS media controls.
    return (
      authManager.isMusicQuizGuest() &&
      router.currentRoute.value.path.startsWith("/music-quiz/play") &&
      !!player.value?.current_media
    );
  });

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
    if (shouldSuppressMetadata.value) {
      return genericQuizMetadata();
    }
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
  const queueElapsed = computed(() => {
    const queueId = playerQueue.value?.queue_id;
    return queueId ? api.queueElapsedTime[queueId] : undefined;
  });
  const unwatch_position = watch(
    () => [
      queueElapsed.value?.elapsed_time,
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
        queueElapsed.value?.elapsed_time != null
          ? queueElapsed.value.elapsed_time
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
