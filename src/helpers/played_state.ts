import {
  MediaType,
  type ItemMapping,
  type MediaItemType,
} from "@/plugins/api/interfaces";

export type PlayedState = "fully_played" | "in_progress";

/**
 * Played state of a podcast episode, audiobook or collection; the server
 * computes a collection's over all its items. Undefined while unplayed.
 */
export const getPlayedState = function (
  item: MediaItemType | ItemMapping,
): PlayedState | undefined {
  if (item.media_type === MediaType.COLLECTION && "items" in item) {
    if (item.metadata.fully_played) return "fully_played";
    return item.metadata.in_progress ? "in_progress" : undefined;
  }
  if ("fully_played" in item && item.fully_played) return "fully_played";
  if ("resume_position_ms" in item && item.resume_position_ms)
    return "in_progress";
  return undefined;
};
