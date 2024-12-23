import { MediaType, QueueItem, Track } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { watch } from "vue";

function playerMediaToMetadata(item: QueueItem) {
  let artist: string | undefined;
  let album: string | undefined;

  //here we cast to Track to access properties that are only available on Track
  if (item.media_item!.media_type === MediaType.TRACK) {
    const currentMedia = item.media_item as Track;
    artist = currentMedia.artists.map((a) => a.name).join(", ");
    album = currentMedia.album.name;
  }

  return new MediaMetadata({
    title: item.media_item!.name,
    artist,
    album,
    artwork: [{ src: item.image?.path ?? "" }],
  });
}

export function useMediaBrowserMetaData() {
  let currentMediaUri: string | undefined;

  //watch the current media to update the metadata
  watch(
    () => store.curQueueItem,
    (newMedia) => {
      if (!newMedia || !newMedia.media_item) return;
      //Lets make sure that the new media isnt spammed
      if (newMedia.media_item.uri === currentMediaUri) return;
      const newMediaMetaData = playerMediaToMetadata(newMedia);
      currentMediaUri = newMedia.media_item.uri;
      navigator.mediaSession.metadata = newMediaMetaData;
    },
  );
}
