// several helpers for dealing with the api and its (media) items

import api from ".";
import { MediaItemType, ItemMapping, MediaType, Player } from "./interfaces";

export const itemIsAvailable = function (
  item: MediaItemType | ItemMapping,
): boolean {
  if (item.media_type == MediaType.FOLDER) return true;
  if ("provider_mappings" in item) {
    for (const x of item.provider_mappings) {
      if (x.available && api.providers[x.provider_instance]?.available)
        return true;
    }
  } else if ("available" in item) return item.available as boolean;
  return false;
};

export const getSourceName = function (player: Player) {
  const source_id = player.active_source || "";
  // source id is a queue id
  if (source_id in api.queues) return api.queues[source_id].display_name;
  for (const source of player.source_list) {
    if (source_id == source.id) {
      return source.name;
    }
  }
  return source_id;
};
