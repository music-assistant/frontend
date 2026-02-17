import {
  Artist,
  BrowseFolder,
  ImageType,
  ItemMapping,
  MediaItemImage,
  MediaItemType,
  MediaItemTypeOrItemMapping,
  MediaType,
  Player,
  PlayerConfig,
  PlaybackState,
  PlayerType,
  ProviderMapping,
  QueueItem,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { api } from "@/plugins/api";
import { marked } from "marked";

import Color from "color";
//@ts-ignore
import ColorThief from "colorthief";
import { store } from "@/plugins/store";
import {
  showContextMenuForMediaItem,
  showPlayMenuForMediaItem,
} from "@/layouts/default/ItemContextMenu.vue";
import { itemIsAvailable } from "@/plugins/api/helpers";
import router from "@/plugins/router";
import { webPlayer, WebPlayerMode } from "@/plugins/web_player";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-vue-next";

export const openLinkInNewTab = function (url: string) {
  if (!url) return url;
  // auto-translate music-assistant.io links to beta site
  if (
    api &&
    api.serverInfo &&
    api.serverInfo.value &&
    (api.serverInfo.value.server_version == "0.0.0" ||
      api.serverInfo.value.server_version.includes("b"))
  ) {
    url = url.replace("://music-assistant.io", "://beta.music-assistant.io");
  }
  window.open(url, "_blank");
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export const parseBool = (val: string | boolean | undefined | null) => {
  if (val == undefined || val == null) return false;
  if (!val) return false;
  if (typeof val === "boolean") return val;
  return !!JSON.parse(String(val).toLowerCase());
};

export const formatDuration = function (totalSeconds: number) {
  totalSeconds = Math.floor(totalSeconds); // round to whole seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds - hours * 3600) / 60);
  const seconds = totalSeconds - hours * 3600 - minutes * 60;
  let hoursStr = hours.toString();
  let minutesStr = minutes.toString();
  let secondsStr = seconds.toString();
  if (hours < 10) {
    hoursStr = "0" + hours;
  }
  if (minutes < 10) {
    minutesStr = "0" + minutes;
  }
  if (seconds < 10) {
    secondsStr = "0" + seconds;
  }
  if (hoursStr === "00") {
    return minutesStr + ":" + secondsStr;
  } else {
    return hoursStr + ":" + minutesStr + ":" + secondsStr;
  }
};

export const truncateString = function (str: string, num: number) {
  if (!str) return "";
  // If the length of str is less than or equal to num
  // just return str--don't truncate it.
  if (str.length <= num) {
    return str;
  }
  // Return str truncated with '...' concatenated to the end of str.
  return str.slice(0, num) + "...";
};

export const isColorDark = function (hexColor: string) {
  if (hexColor.includes("var")) {
    hexColor = getComputedStyle(document.documentElement).getPropertyValue(
      hexColor,
    );
  }
  let r = 0;
  let g = 0;
  let b = 0;
  if (hexColor.includes("rgb(")) {
    const parts = hexColor.split("(")[1].split(")")[0].split(",");
    r = parseInt(parts[0]);
    g = parseInt(parts[1]);
    b = parseInt(parts[2]);
  } else {
    const c = hexColor.substring(1); // strip #
    const rgb = parseInt(c, 16); // convert rrggbb to decimal
    r = (rgb >> 16) & 0xff; // extract red
    g = (rgb >> 8) & 0xff; // extract green
    b = (rgb >> 0) & 0xff; // extract blue
  }
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

  return luma < 128;
};

export const kebabize = (str: string) => {
  return str
    .split("")
    .map((letter, idx) => {
      return letter.toUpperCase() === letter
        ? `${idx !== 0 ? "-" : ""}${letter.toLowerCase()}`
        : letter;
    })
    .join("");
};

export const getArtistsString = function (
  artists: Array<Artist | ItemMapping>,
  size?: number,
) {
  if (!artists) return "";
  if (size)
    return artists
      .slice(0, size)
      .map((x) => {
        return x.name;
      })
      .join(" | ");
  return artists
    .map((x) => {
      return x.name;
    })
    .join(" | ");
};

export const getBrowseFolderName = function (browseItem: BrowseFolder, t: any) {
  let browseTitle = "";
  if (browseItem?.name && browseItem?.translation_key) {
    browseTitle = `${browseItem.name}: ${t(browseItem?.translation_key)}`;
  } else if (browseItem?.name) {
    browseTitle = browseItem.name;
  } else if (browseItem?.translation_key) {
    browseTitle = t(browseItem?.translation_key);
  } else {
    browseTitle = browseItem.path || "";
  }
  return browseTitle;
};

export const getPlayerName = function (player: Player, truncate = 26) {
  if (!player) return "";
  const availableChildPlayers = player.group_members.filter(
    (x) => api.players[x]?.available && x != player.player_id,
  );
  if (player.type != PlayerType.GROUP && availableChildPlayers.length) {
    return `${truncateString(player.name, truncate - 3)} +${
      availableChildPlayers.length
    }`;
  }
  return truncateString(player.name, truncate);
};

export const getStreamingProviderMappings = function (
  itemDetails: MediaItemType,
) {
  const result: ProviderMapping[] = [];
  for (const provider_mapping of itemDetails?.provider_mappings || []) {
    if (provider_mapping.provider_domain.startsWith("filesystem")) continue;
    if (provider_mapping.provider_domain == "plex") continue;
    if (
      result.filter(
        (a) => a.provider_domain == provider_mapping.provider_domain,
      ).length
    )
      continue;
    result.push(provider_mapping);
  }
  return result;
};

export const sleep = (delay: number) =>
  new Promise((resolve) => setTimeout(resolve, delay));

/**
 * Get the proper image URL for player media, handling protocol mismatches
 * and backend-provided imageproxy URLs.
 *
 * - If URL is HTTP but frontend is served over HTTPS, proxy through imageproxy
 * - If URL is already an imageproxy URL from another host, transform to use our baseUrl
 * - Otherwise return the URL as-is
 */
export const getMediaImageUrl = function (
  imageUrl: string | undefined,
): string {
  if (!imageUrl) return "";

  // Handle data URLs directly
  if (imageUrl.startsWith("data:image")) return imageUrl;

  // Check if this is already an imageproxy URL from the backend
  // e.g., http://192.168.1.1:8097/imageproxy?provider=tunein&size=500&path=...
  if (imageUrl.includes("/imageproxy") && imageUrl.includes("provider=")) {
    // Extract query params and rebuild with our baseUrl
    const url = new URL(imageUrl);
    const params = url.searchParams.toString();
    return `${api.baseUrl}/imageproxy?${params}`;
  }

  // Check for protocol mismatch: HTTP image URL but HTTPS frontend
  const urlProtocol = imageUrl.split("://")[0];
  const pageProtocol = window.location.protocol.replace(":", "");

  if (urlProtocol === "http" && pageProtocol === "https") {
    // Proxy through imageproxy to avoid mixed content issues
    const encUrl = encodeURIComponent(encodeURIComponent(imageUrl));
    return `${api.baseUrl}/imageproxy?path=${encUrl}`;
  }

  return imageUrl;
};

/**
 * Check if an image provider is available.
 */
const imageProviderIsAvailable = function (provider: string) {
  if (provider === "http" || provider === "builtin") return true;
  return api.getProvider(provider)?.available === true;
};

/**
 * Get image from a MediaItem, ItemMapping, or QueueItem.
 */
export const getMediaItemImage = function (
  mediaItem?: MediaItemType | ItemMapping | QueueItem,
  type: ImageType = ImageType.THUMB,
): MediaItemImage | undefined {
  if (!mediaItem) return undefined;

  // handle QueueItem
  if ("media_item" in mediaItem && mediaItem.media_item) {
    // prefer image_url provided in queueItem's streamdetails
    if (
      "streamdetails" in mediaItem.media_item &&
      mediaItem.streamdetails?.stream_metadata?.image_url
    )
      return {
        type: ImageType.THUMB,
        path: mediaItem.streamdetails.stream_metadata.image_url,
        provider: "builtin",
        remotely_accessible: true,
      };
    // fallback to media_item's image
    const mediaItemImage = getMediaItemImage(mediaItem.media_item);
    if (mediaItemImage) return mediaItemImage;
  }

  // handle image in queueitem or itemmapping
  if (
    "image" in mediaItem &&
    mediaItem.image &&
    mediaItem.image.type == type &&
    imageProviderIsAvailable(mediaItem.image.provider)
  )
    return mediaItem.image;

  // always prefer album image for tracks
  if ("album" in mediaItem && mediaItem.album) {
    const albumImage = getMediaItemImage(mediaItem.album, type);
    if (albumImage) return albumImage;
  }

  // handle regular image within mediaitem
  if ("metadata" in mediaItem && mediaItem.metadata.images) {
    for (const img of mediaItem.metadata.images) {
      if (img.type == type && imageProviderIsAvailable(img.provider))
        return img;
    }
  }

  // retry with album/track artist(s)
  if ("artists" in mediaItem && mediaItem.artists) {
    for (const artist of mediaItem.artists) {
      const artistImage = getMediaItemImage(artist, type);
      if (artistImage) return artistImage;
    }
  }

  // allow landscape fallback
  if (type == ImageType.THUMB) {
    return getMediaItemImage(mediaItem, ImageType.LANDSCAPE);
  }
};

/**
 * Get the URL for a MediaItemImage, handling protocol mismatches and resizing.
 * This is used for MediaItem images (albums, tracks, artists, etc.)
 */
export const getMediaItemImageUrl = function (
  img: MediaItemImage,
  size?: number,
  checksum?: string,
): string {
  if (!checksum) checksum = "";
  if (!img || !img.path) return "";
  if (img.path.startsWith("data:image")) return img.path;
  if (
    !img.remotely_accessible ||
    size ||
    img.path.split("//")[0] != window.location.protocol
  ) {
    // force imageproxy if image is not remotely accessible or we need a resized thumb
    // Note that we play it safe here and always enforce the proxy if the schema is different
    const encUrl = encodeURIComponent(encodeURIComponent(img.path));
    const imageUrl = `${api.baseUrl}/imageproxy?path=${encUrl}&provider=${img.provider}&checksum=${checksum}`;
    if (size) return imageUrl + `&size=${size}`;
    return imageUrl;
  }
  // else: return image as-is (use getMediaImageUrl for protocol handling)
  return getMediaImageUrl(img.path);
};

/**
 * Get the image thumbnail URL for a MediaItem, ItemMapping, or QueueItem.
 */
export const getImageThumbForItem = function (
  mediaItem?: MediaItemType | ItemMapping | QueueItem,
  type: ImageType = ImageType.THUMB,
  size?: number,
): string | undefined {
  if (!mediaItem) return;
  // find image in mediaitem
  const img = getMediaItemImage(mediaItem, type);
  if (!img || !img.path) return undefined;
  const checksum =
    "metadata" in mediaItem ? mediaItem.metadata?.cache_checksum : "";
  return getMediaItemImageUrl(img, size, checksum);
};

export const numberRange = function (start: number, end: number): number[] {
  return Array(end - start + 1)
    .fill(start)
    .map((x, y) => x + y);
};

//Get correct colour
type RGBColor = [number, number, number];

export interface ImageColorPalette {
  [key: number]: string;
  lightColor: string;
  darkColor: string;
}

export function getContrastingTextColor(hexColor: string): string {
  hexColor = hexColor.replace("#", "");
  if (hexColor.length === 3) {
    hexColor = hexColor
      .split("")
      .map((hex) => hex + hex)
      .join("");
  }

  const r = parseInt(hexColor.substr(0, 2), 16);
  const g = parseInt(hexColor.substr(2, 2), 16);
  const b = parseInt(hexColor.substr(4, 2), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.7) {
    return "#000000";
  } else {
    return "#FFFFFF";
  }
}

export function getContrastRatio(color1: string, color2: string): number {
  const c1 = Color(color1);
  const c2 = Color(color2);
  return c1.contrast(c2);
}

export function lightenColor(hexCode: string, factor: number): string {
  if (factor <= 0 || factor > 1) {
    throw new Error("Factor must be in the range of 0 (exclusive) to 1.");
  }

  const rgbColor: RGBColor = hexToRgb(hexCode);

  const newRgbColor: RGBColor = [
    Math.min(255, Math.round(rgbColor[0] + (255 - rgbColor[0]) * factor)),
    Math.min(255, Math.round(rgbColor[1] + (255 - rgbColor[1]) * factor)),
    Math.min(255, Math.round(rgbColor[2] + (255 - rgbColor[2]) * factor)),
  ];

  return rgbToHex(newRgbColor);
}

export function hexToRgb(hex: string): RGBColor {
  const bigint = parseInt(hex.startsWith("#") ? hex.slice(1) : hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

export function rgbToHex(rgb: RGBColor): string {
  const [red, green, blue] = rgb;
  const hex = `#${red.toString(16).padStart(2, "0")}${green
    .toString(16)
    .padStart(2, "0")}${blue.toString(16).padStart(2, "0")}`;
  return hex;
}

export function findLightColor(colors: RGBColor[]): string {
  let mostPleasantColor = "";
  let highestContrastRatio = 0;

  colors.forEach((rgb) => {
    const hexColor = rgbToHex(rgb);
    const contrastRatio = getContrastRatio("#000000", hexColor);

    if (
      (contrastRatio > highestContrastRatio && contrastRatio >= 7) ||
      (contrastRatio > highestContrastRatio &&
        contrastRatio >= highestContrastRatio * 0.7)
    ) {
      highestContrastRatio = contrastRatio;
      mostPleasantColor = hexColor;
    }
  });
  return mostPleasantColor;
}

export function findDarkColor(colors: RGBColor[]): string {
  let mostPleasantColor = "";
  let highestContrastRatio = 0;
  const maxContrastRatio = 17.35;

  colors.forEach((rgb) => {
    const hexColor = rgbToHex(rgb);
    const contrastRatio = getContrastRatio("#fff", hexColor);
    if (maxContrastRatio >= contrastRatio) {
      if (
        (contrastRatio > highestContrastRatio && contrastRatio >= 7) ||
        (contrastRatio > highestContrastRatio &&
          contrastRatio >= highestContrastRatio * 0.7)
      ) {
        highestContrastRatio = contrastRatio;
        mostPleasantColor = hexColor;
      }
    }
  });
  return mostPleasantColor;
}

export function getColorPalette(img: HTMLImageElement): ImageColorPalette {
  const colorThief = new ColorThief();
  const colorNumberPalette: RGBColor[] = colorThief.getPalette(img, 5);
  const colorHexPalette: string[] = colorNumberPalette.map((color) =>
    rgbToHex(color),
  );

  return {
    0: colorHexPalette[0],
    1: colorHexPalette[1],
    2: colorHexPalette[2],
    3: colorHexPalette[3],
    4: colorHexPalette[4],
    lightColor: findLightColor(colorNumberPalette),
    darkColor: findDarkColor(colorNumberPalette),
  };
}

export function getValueFromSources(isAvailabe: any, sources: string | any[]) {
  if (isAvailabe) {
    return isAvailabe;
  }

  for (const element of sources) {
    const source = element;
    const expression = source[0];
    const valueIfTrue = source[1];
    const valueIfFalse = source[2];

    if (expression) {
      return valueIfTrue;
    } else if (valueIfFalse !== undefined) {
      return valueIfFalse;
    }
  }

  return undefined;
}

export function scrollElement(el: HTMLElement, to: number, duration: number) {
  const start = el.scrollTop;
  const change = to - start;
  const startDate = new Date().getTime();

  const easeInOutQuad = (t: number, b: number, c: number, d: number) => {
    t /= d / 2;
    if (t < 1) return (c / 2) * t * t + b;
    t--;
    return (-c / 2) * (t * (t - 2) - 1) + b;
  };

  const animateScroll = () => {
    const currentDate = new Date().getTime();
    const elapsedTime = currentDate - startDate;
    el.scrollTop = easeInOutQuad(elapsedTime, start, change, duration);
    if (elapsedTime < duration) {
      requestAnimationFrame(animateScroll);
    } else {
      el.scrollTop = to;
    }
  };

  animateScroll();
}

export const panelViewItemResponsive = function (displaySize: number) {
  if (
    getBreakpointValue({
      breakpoint: "bp1",
      condition: "lt",
    })
  ) {
    return 2;
  } else if (
    getBreakpointValue({
      breakpoint: "bp1",
      condition: "gt",
    }) &&
    getBreakpointValue({
      breakpoint: "bp4",
      condition: "lt",
    })
  ) {
    return 3;
  } else if (
    getBreakpointValue({
      breakpoint: "bp4",
      condition: "gt",
    }) &&
    getBreakpointValue({
      breakpoint: "bp6",
      condition: "lt",
    })
  ) {
    return 4;
  } else if (
    getBreakpointValue({
      breakpoint: "bp6",
      condition: "gt",
    }) &&
    getBreakpointValue({
      breakpoint: "bp7",
      condition: "lt",
    })
  ) {
    return 5;
  } else if (
    getBreakpointValue({
      breakpoint: "bp7",
      condition: "gt",
    }) &&
    getBreakpointValue({
      breakpoint: "bp8",
      condition: "lt",
    })
  ) {
    return 6;
  } else if (
    getBreakpointValue({
      breakpoint: "bp8",
      condition: "gt",
    }) &&
    getBreakpointValue({
      breakpoint: "bp9",
      condition: "lt",
    })
  ) {
    return 7;
  } else if (
    getBreakpointValue({
      breakpoint: "bp9",
      condition: "gt",
    }) &&
    getBreakpointValue({
      breakpoint: "bp10",
      condition: "lt",
    })
  ) {
    return 8;
  } else if (
    getBreakpointValue({
      breakpoint: "bp10",
      condition: "gt",
    })
  ) {
    return 9;
  } else {
    return 0;
  }
};

export function isTouchscreenDevice() {
  // detect if device/browser is touch enabled
  let result = false;
  if (window.PointerEvent && "maxTouchPoints" in navigator) {
    if (navigator.maxTouchPoints > 0) {
      result = true;
    }
  } else {
    if (
      window.matchMedia &&
      window.matchMedia("(any-pointer:coarse)").matches
    ) {
      result = true;
    } else if (window.TouchEvent || "ontouchstart" in window) {
      result = true;
    }
  }
  return result;
}

export const markdownToHtml = function (text: string): string {
  text = text
    .replaceAll(/\\n/g, "<br />")
    .replaceAll("\n", "<br />")
    .replaceAll(" \\", "<br />");
  return marked(text) as string;
};

/**
 * Copy text to clipboard with proper error handling.
 *
 * Handles scenarios where navigator.clipboard is unavailable (non-HTTPS contexts,
 * unsupported browsers, or permission issues) by falling back to a temporary
 * textarea element.
 *
 * :param text: The text to copy to the clipboard.
 * :return: Promise that resolves to true if successful, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Try modern Clipboard API first (requires HTTPS or localhost)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error(
        "Clipboard API failed, falling back to legacy method:",
        error,
      );
    }
  }

  // Fallback for older browsers or non-secure contexts
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);

    if (successful) {
      return true;
    } else {
      console.error("Legacy copy method failed");
      return false;
    }
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  }
}

export const playerVisible = function (
  player: Player,
  allowGroupChilds = false,
): boolean {
  // perform some basic checks if we may use/show the player
  if (!player.enabled) return false;
  if (
    player.hide_in_ui &&
    player.output_protocols?.filter(
      (x) =>
        x.output_protocol_id === webPlayer.player_id ||
        x.output_protocol_id === store.companionPlayerId,
    ).length === 0
  ) {
    return false;
  }
  if (player.synced_to && !allowGroupChilds) {
    return false;
  }
  if (player.active_group && !allowGroupChilds) return false;
  if (!player.available) {
    return false;
  }
  if (
    store.currentUser &&
    store.currentUser.player_filter.length > 0 &&
    player.player_id != webPlayer.player_id &&
    !store.currentUser.player_filter.includes(player.player_id)
  ) {
    // for non-admin users, the playerfilter is applied in the backend
    // but for admin users we need to filter here as well
    return false;
  }
  return true;
};

/* Handle play button click */
export const handlePlayBtnClick = function (
  item: MediaItemTypeOrItemMapping,
  posX: number,
  posY: number,
  parentItem?: MediaItemType,
  forceMenu?: boolean,
) {
  // we show the play menu for the item once (if playerTip has not been dismissed)
  if (!forceMenu && store.activePlayer?.available) {
    store.playActionInProgress = true;
    if (
      item.media_type == MediaType.TRACK &&
      parentItem?.media_type == MediaType.PLAYLIST &&
      store.activePlayerQueue &&
      (store.activePlayerQueue.items <= 1 ||
        store.activePlayerQueue.state != PlaybackState.PLAYING)
    ) {
      // special case: playing a track from a playlist - play playlist from here
      api.playMedia(parentItem.uri, undefined, false, item.item_id).then(() => {
        store.playActionInProgress = false;
      });
      return;
    }
    // else: play the item directly
    api.playMedia(item).then(() => {
      store.playActionInProgress = false;
    });
    return;
  }
  showPlayMenuForMediaItem(item, parentItem, posX, posY);
};

/* Handle media item click */
export const handleMediaItemClick = function (
  item: MediaItemTypeOrItemMapping,
  posX: number,
  posY: number,
  parentItem?: MediaItemType,
) {
  // open menu when item is unavailable so the user has a way to remove/refresh the item
  if (!itemIsAvailable(item)) {
    handleMenuBtnClick(item, posX, posY, undefined, false);
    return;
  }

  // folder items always open in browse view
  if (item.media_type == MediaType.FOLDER) {
    router.push({
      name: "browse",
      query: {
        path: (item as BrowseFolder).path,
      },
    });
    return;
  }

  // podcast episode has no details view so show play menu directly
  // TODO: revisit this once we have a proper podcast episode details view
  if (item.media_type == MediaType.PODCAST_EPISODE) {
    handlePlayBtnClick(item, posX, posY, parentItem, true);
    return;
  }

  // all other: go to details view
  router.push({
    name: item.media_type,
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};

/* Handle menu button click */
export const handleMenuBtnClick = function (
  item: MediaItemTypeOrItemMapping | MediaItemTypeOrItemMapping[],
  posX: number,
  posY: number,
  parentItem?: MediaItemType,
  includePlayMenuItems = true,
) {
  const mediaItems: MediaItemTypeOrItemMapping[] = Array.isArray(item)
    ? item
    : [item];
  showContextMenuForMediaItem(
    mediaItems,
    parentItem,
    posX,
    posY,
    includePlayMenuItems,
    includePlayMenuItems,
  );
};

/**
 * Get platform-specific default sync delay for Sendspin player.
 * Based on testing across various platforms/browsers.
 */
export const getSendspinDefaultSyncDelay = function (): number {
  const ua = navigator.userAgent;
  const isAndroid = /android/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isFirefox = /firefox/i.test(ua);

  if (isIOS) {
    return -250;
  } else if (!isAndroid && !isFirefox) {
    // Desktop Chrome/Chromium/Edge
    return -300;
  }
  // Android, Firefox (desktop/mobile)
  return -200;
};

/**
 * Check if a player config should be hidden from settings due to being a
 * Sendspin web player that is currently unavailable.
 *
 * This prevents users from being confused by a lot of auto-generated players
 * in the Players and Providers settings pages.
 */
export const isHiddenSendspinWebPlayer = function (
  playerConfig: PlayerConfig,
): boolean {
  if (playerConfig.provider !== "sendspin") return false;

  const name = playerConfig.default_name || "";
  if (
    !name.startsWith("Music Assistant (") && // PWA app
    !name.startsWith("Music Assistant Web (") // Regular web interface
  ) {
    return false;
  }

  const player = api.players[playerConfig.player_id];
  return !player?.available;
};

export const getVolumeIconComponent = function (
  player: Player,
  displayVolume?: number,
) {
  if (player.volume_muted) {
    return VolumeX;
  }

  const volume =
    displayVolume !== undefined
      ? displayVolume
      : player.group_members.length
        ? player.group_volume
        : player.volume_level || 0;

  if (volume === 0) {
    return Volume;
  } else if (volume < 50) {
    return Volume1;
  } else {
    return Volume2;
  }
};
