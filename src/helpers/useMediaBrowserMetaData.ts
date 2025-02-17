import { getImageThumbForItem } from "@/components/MediaItemThumb.vue";
import {
  ImageType,
  MediaType,
  QueueItem,
  Track,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { watch } from "vue";

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

export function useMediaBrowserMetaData() {
  let currentMediaUri: string | undefined;

  //watch the current media to update the metadata
  const unwatch_metadata = watch(
    () => store.curQueueItem,
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
      store.activePlayerQueue?.elapsed_time,
      store.activePlayerQueue?.current_item?.duration,
    ],
    () => {
      const duration = store.activePlayerQueue?.current_item?.duration;
      const position = Math.min(
        duration || 0,
        store.activePlayerQueue?.elapsed_time || 0,
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
