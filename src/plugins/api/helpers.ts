// several helpers for dealing with the api and its (media) items

import api from '.';
import { MediaItemType, ItemMapping, MediaType } from './interfaces';

export const itemIsAvailable = function (item: MediaItemType | ItemMapping) {
  if (item.media_type == MediaType.FOLDER) return true;
  if ('provider_mappings' in item) {
    for (const x of item.provider_mappings) {
      if (x.available && api.providers[x.provider_instance]?.available)
        return true;
    }
  } else if ('available' in item) return item.available;
  return false;
};
