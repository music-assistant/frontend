import ArtistIcon from "@/components/icons/ArtistIcon.vue";
import GenreIcon from "@/components/icons/GenreIcon.vue";
import { MediaType } from "@/plugins/api/interfaces";
import {
  BookAudio,
  Disc3,
  Folder,
  ListMusic,
  Music2,
  Podcast,
  Radio,
} from "@lucide/vue";
import type { Component } from "vue";

// mirrors the icons of the matching entries in the navigation menu
// (src/components/navigation/utils/getMenuItems.ts)
const MEDIA_TYPE_ICONS: Partial<Record<MediaType, Component>> = {
  [MediaType.ARTIST]: ArtistIcon,
  [MediaType.ALBUM]: Disc3,
  [MediaType.TRACK]: Music2,
  [MediaType.PLAYLIST]: ListMusic,
  [MediaType.AUDIOBOOK]: BookAudio,
  [MediaType.PODCAST]: Podcast,
  [MediaType.PODCAST_EPISODE]: Podcast,
  [MediaType.RADIO]: Radio,
  [MediaType.GENRE]: GenreIcon,
  [MediaType.FOLDER]: Folder,
};

/**
 * The icon the navigation menu shows for a media type, used in place of
 * missing artwork; undefined for types without a menu entry.
 */
export function getMediaTypeIcon(mediaType?: MediaType): Component | undefined {
  return mediaType ? MEDIA_TYPE_ICONS[mediaType] : undefined;
}
