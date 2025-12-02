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

/**
 * Generate a friendly device name from the user agent.
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  let os = "Unknown OS";

  // Detect browser
  if (ua.includes("Firefox/")) {
    browser = "Firefox";
  } else if (ua.includes("Edg/")) {
    browser = "Edge";
  } else if (ua.includes("Chrome/")) {
    browser = "Chrome";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
    browser = "Safari";
  }

  // Detect OS
  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac OS X")) {
    os = "macOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (
    ua.includes("iOS") ||
    ua.includes("iPhone") ||
    ua.includes("iPad")
  ) {
    os = "iOS";
  }

  return `Music Assistant Web (${browser} on ${os})`;
}
