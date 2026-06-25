// shared logic to decide whether "radio mode" (an endless similar-tracks mix)
// can be started from a given media item
import api from "@/plugins/api";
import {
  MediaItemTypeOrItemMapping,
  MediaType,
  Playlist,
  ProviderFeature,
} from "@/plugins/api/interfaces";

export const radioModeSupported = (
  item: MediaItemTypeOrItemMapping,
): boolean => {
  if (
    ![
      MediaType.TRACK,
      MediaType.ARTIST,
      MediaType.ALBUM,
      MediaType.PLAYLIST,
    ].includes(item.media_type)
  ) {
    return false;
  }
  // dynamic playlists own their own track feed — radio mode would conflict
  if (item.media_type === MediaType.PLAYLIST && (item as Playlist).is_dynamic) {
    return false;
  }
  if ("provider_mappings" in item) {
    for (const provId of item.provider_mappings) {
      if (
        api.providers[provId.provider_instance]?.supported_features.includes(
          ProviderFeature.SIMILAR_TRACKS,
        )
      )
        return true;
    }
  } else if (
    api.providers[item.provider]?.supported_features.includes(
      ProviderFeature.SIMILAR_TRACKS,
    )
  ) {
    return true;
  }
  // generic radio mode: any provider supports similar tracks and the item is
  // (matched) in the library
  if (item.provider === "library") {
    for (const prov of Object.values(api.providers)) {
      if (prov.supported_features.includes(ProviderFeature.SIMILAR_TRACKS))
        return true;
    }
  }
  return false;
};
