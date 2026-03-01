// several helpers for dealing with the api and its (media) items

import api from ".";
import {
  MediaItemType,
  ItemMapping,
  MediaType,
  Player,
  PlayerFeature,
} from "./interfaces";

export const itemIsAvailable = function (
  item: MediaItemType | ItemMapping,
): boolean {
  if (item.media_type == MediaType.FOLDER) return true;
  if (
    (item.media_type == MediaType.GENRE ||
      item.media_type == MediaType.GENRE_ALIAS) &&
    item.provider == "library"
  )
    return true;
  if ("provider_mappings" in item && Array.isArray(item.provider_mappings)) {
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
 * Generate a friendly device name from the user agent and browser APIs.
 * Uses User-Agent Client Hints API when available for more accurate detection.
 */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  let device = "";

  // Detect browser
  if (ua.includes("OPR/") || ua.includes("Opera/")) {
    browser = "Opera";
  } else if (ua.includes("Vivaldi/")) {
    browser = "Vivaldi";
  } else if (ua.includes("Brave/")) {
    browser = "Brave";
  } else if (ua.includes("SamsungBrowser/")) {
    browser = "Samsung Browser";
  } else if (ua.includes("Firefox/") || ua.includes("FxiOS/")) {
    browser = "Firefox";
  } else if (ua.includes("Edg/") || ua.includes("EdgiOS/")) {
    browser = "Edge";
  } else if (ua.includes("CriOS/")) {
    browser = "Chrome";
  } else if (ua.includes("Chrome/") && !ua.includes("Chromium/")) {
    browser = "Chrome";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
    browser = "Safari";
  }

  // Try to detect specific device from user agent
  // Check iOS devices first (contain "Mac OS X" in UA)
  if (ua.includes("iPhone")) {
    device = "iPhone";
  } else if (ua.includes("iPad")) {
    device = "iPad";
  } else if (ua.includes("iPod")) {
    device = "iPod";
  }
  // Android devices - try to extract model name
  else if (ua.includes("Android")) {
    const androidMatch = ua.match(/;\s*([^;)]+)\s*Build\//);
    if (androidMatch && androidMatch[1]) {
      const model = androidMatch[1].trim();
      // Clean up common prefixes and provide friendly names
      if (model.startsWith("SM-")) {
        device = `Samsung ${model}`;
      } else if (model.startsWith("Pixel")) {
        device = `Google ${model}`;
      } else if (model.startsWith("SAMSUNG") || model.startsWith("samsung")) {
        device = model.replace(/SAMSUNG[- ]?/i, "Samsung ");
      } else if (model.startsWith("Redmi") || model.startsWith("Mi ")) {
        device = `Xiaomi ${model}`;
      } else if (model.startsWith("ONEPLUS") || model.startsWith("OnePlus")) {
        device = model.replace(/ONEPLUS/i, "OnePlus");
      } else if (model.startsWith("moto") || model.startsWith("Moto")) {
        device = `Motorola ${model}`;
      } else if (model.startsWith("Nokia")) {
        device = model;
      } else if (model.startsWith("LG-") || model.startsWith("LM-")) {
        device = `LG ${model}`;
      } else if (model.startsWith("HUAWEI") || model.startsWith("VOG-")) {
        device = model.replace(/HUAWEI[- ]?/i, "Huawei ");
      } else if (model.startsWith("OPPO") || model.startsWith("CPH")) {
        device = model.startsWith("CPH") ? `OPPO ${model}` : model;
      } else if (model.startsWith("vivo") || model.startsWith("V")) {
        device = model.startsWith("vivo") ? model : `vivo ${model}`;
      } else if (model.startsWith("RMX")) {
        device = `Realme ${model}`;
      } else if (model !== "K" && model.length > 1) {
        // Use model if it looks reasonable
        device = model;
      } else {
        device = "Android";
      }
    } else {
      // Check for tablets
      if (
        ua.includes("Tablet") ||
        (ua.includes("Android") && !ua.includes("Mobile"))
      ) {
        device = "Android Tablet";
      } else {
        device = "Android";
      }
    }
  }
  // Desktop/other platforms
  else if (ua.includes("Windows NT 10")) {
    device = "Windows";
  } else if (ua.includes("Windows NT 6.3")) {
    device = "Windows 8.1";
  } else if (ua.includes("Windows NT 6.2")) {
    device = "Windows 8";
  } else if (ua.includes("Windows NT 6.1")) {
    device = "Windows 7";
  } else if (ua.includes("Windows")) {
    device = "Windows";
  } else if (ua.includes("Mac OS X")) {
    device = "Mac";
  } else if (ua.includes("CrOS")) {
    device = "ChromeOS";
  } else if (ua.includes("Linux")) {
    device = "Linux";
  } else if (ua.includes("FreeBSD")) {
    device = "FreeBSD";
  }

  // Use userAgentData if available for more accurate platform detection (Chromium browsers)
  if ("userAgentData" in navigator && navigator.userAgentData) {
    const uaData = navigator.userAgentData as NavigatorUAData;
    if (uaData.platform) {
      // Only override if we didn't get a specific device from UA parsing
      if (!device || device === "Android" || device === "Android Tablet") {
        if (uaData.platform === "Android") {
          device = uaData.mobile ? "Android" : "Android Tablet";
        } else if (uaData.platform === "Chrome OS") {
          device = "ChromeOS";
        }
      }
    }
  }

  if (!device) {
    device = "Unknown Device";
  }

  // Check if running as installed PWA
  const isPwa =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone: boolean }).standalone);

  const appType = isPwa ? "PWA" : "Web";

  return `${appType} (${browser} on ${device})`;
}

interface NavigatorUAData {
  platform: string;
  mobile: boolean;
}

export const handlePlayerMuteToggle = function (player: Player) {
  if (player.group_members.length > 0) {
    // TODO: revisit this when api/server supports group mute toggle
    const muted = !player.volume_muted;
    for (const memberId of player.group_members) {
      const childPlayer = api.players[memberId];
      if (!childPlayer) continue;
      if (!childPlayer.supported_features.includes(PlayerFeature.VOLUME_MUTE)) {
        continue;
      }
      api.playerCommandVolumeMute(memberId, muted);
    }
  } else {
    api.playerCommandMuteToggle(player.player_id);
  }
};
