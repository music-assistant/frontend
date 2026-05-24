import { api } from "@/plugins/api";
import {
  Artist,
  BrowseFolder,
  ImageType,
  ItemMapping,
  MediaItemImage,
  MediaItemType,
  MediaItemTypeOrItemMapping,
  MediaType,
  PlaybackState,
  Player,
  PlayerConfig,
  PlayerType,
  ProviderMapping,
  QueueItem,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { marked } from "marked";

import {
  showContextMenuForMediaItem,
  showPlayMenuForMediaItem,
} from "@/layouts/default/ItemContextMenu.vue";
import { itemIsAvailable } from "@/plugins/api/helpers";
import router from "@/plugins/router";
import { store } from "@/plugins/store";
import { webPlayer } from "@/plugins/web_player";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-vue-next";
import type { MediaItemPalette } from "@/plugins/api/interfaces";

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

export const formatAliasName = (name: string) =>
  name ? name.replace(/(^|\s)\S/g, (match) => match.toUpperCase()) : "";

export const formatRelativeTime = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const buildItemUri = function (
  mediaType: MediaType,
  mapping: ProviderMapping | null,
  fallbackItemId: string,
): string {
  const domain = mapping?.provider_domain ?? "library";
  const itemId = mapping?.item_id ?? fallbackItemId;
  return `${domain}://${mediaType}/${itemId}`;
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

export const toSentenceCase = function (str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const genreKeyFromName = function (name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

export const getGenreDisplayName = function (
  name: string,
  translationKey: string | undefined,
  t: (key: string) => string,
  te: (key: string) => boolean,
): string {
  // First try the translation key as-is (in case backend sends full key like 'genre_names.afrobeats')
  if (translationKey && te(translationKey)) return t(translationKey);

  // Then try with genre_names prefix (in case backend sends just the key name like 'afrobeats')
  if (translationKey) {
    const keyWithPrefix = `genre_names.${translationKey}`;
    if (te(keyWithPrefix)) return t(keyWithPrefix);
  }

  // Fallback: generate key from name
  const key = `genre_names.${genreKeyFromName(name)}`;
  if (te(key)) return t(key);

  // No translation found - apply sentence case for user-created/promoted genres
  return name;
};

export const getGenreDescription = function (
  name: string,
  translationKey: string | undefined,
  t: (key: string) => string,
  te: (key: string) => boolean,
): string {
  // First try the translation key with genre_descriptions prefix
  if (translationKey) {
    const keyWithPrefix = `genre_descriptions.${translationKey}`;
    if (te(keyWithPrefix)) return t(keyWithPrefix);
  }

  // Fallback: generate key from name
  const key = `genre_descriptions.${genreKeyFromName(name)}`;
  if (te(key)) return t(key);

  return "";
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

export const getBrowseFolderName = function (
  browseItem: BrowseFolder,
  t: (key: string) => string,
) {
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
  if (!itemDetails || !("provider_mappings" in itemDetails)) return result;
  for (const provider_mapping of itemDetails.provider_mappings || []) {
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

// Server API schema version that introduced the opaque /imageproxy/<proxy_id>
// endpoint, the proxy_id field on MediaItemImage, and the size whitelist
// enforced on both the new and legacy /imageproxy routes.
// See music-assistant/server#3960.
const IMAGEPROXY_OPAQUE_ID_SCHEMA_VERSION = 31;

// Sizes accepted by the imageproxy on schema >= 31 (both endpoints). 0 means
// no resize. Anything else returns HTTP 400, so we round up to the next
// allowed value for arbitrary caller-supplied sizes.
const IMAGEPROXY_ALLOWED_SIZES = [80, 160, 256, 512, 1024] as const;

const serverSupportsOpaqueImageProxy = function (): boolean {
  const schema = api.serverInfo.value?.schema_version;
  return (
    typeof schema === "number" && schema >= IMAGEPROXY_OPAQUE_ID_SCHEMA_VERSION
  );
};

const normalizeImageProxySize = function (size?: number): number {
  if (!size || size <= 0) return 0;
  if (!serverSupportsOpaqueImageProxy()) return size;
  for (const allowed of IMAGEPROXY_ALLOWED_SIZES) {
    if (size <= allowed) return allowed;
  }
  return IMAGEPROXY_ALLOWED_SIZES[IMAGEPROXY_ALLOWED_SIZES.length - 1];
};

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

  // Rebuild existing imageproxy URLs with our baseUrl. Two URL shapes exist:
  //   legacy: http://host/imageproxy?provider=tunein&size=500&path=...
  //   opaque: http://host/imageproxy/<64-hex-id>?size=256&fmt=jpg
  // Pass a base so relative inputs like `/imageproxy/<id>?size=...` parse,
  // and swallow parse errors so a malformed input falls through unchanged.
  if (imageUrl.includes("/imageproxy")) {
    try {
      const url = new URL(imageUrl, api.baseUrl || window.location.href);
      if (url.pathname.startsWith("/imageproxy/")) {
        const proxyId = url.pathname.slice("/imageproxy/".length);
        const params = url.searchParams.toString();
        return params
          ? `${api.baseUrl}/imageproxy/${proxyId}?${params}`
          : `${api.baseUrl}/imageproxy/${proxyId}`;
      }
      if (url.searchParams.has("provider")) {
        return `${api.baseUrl}/imageproxy?${url.searchParams.toString()}`;
      }
    } catch {
      // fall through and return imageUrl as-is below
    }
  }

  // Check for protocol mismatch: HTTP image URL but HTTPS frontend
  const urlProtocol = imageUrl.split("://")[0];
  const pageProtocol = window.location.protocol.replace(":", "");

  if (urlProtocol === "http" && pageProtocol === "https") {
    // Proxy through imageproxy to avoid mixed content issues. The opaque-id
    // form requires a server-issued proxy_id which we don't have here, so
    // fall back to the legacy query-string form (still supported).
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
    const normalizedSize = normalizeImageProxySize(size);
    if (img.proxy_id && serverSupportsOpaqueImageProxy()) {
      // canonical /imageproxy/<proxy_id>?size=&checksum= form. checksum is kept
      // as a cache-buster query param (the server ignores unknown params).
      const params = new URLSearchParams();
      if (normalizedSize) params.set("size", String(normalizedSize));
      if (checksum) params.set("checksum", checksum);
      const qs = params.toString();
      return qs
        ? `${api.baseUrl}/imageproxy/${img.proxy_id}?${qs}`
        : `${api.baseUrl}/imageproxy/${img.proxy_id}`;
    }
    // legacy form, for servers on schema < 31 or images without a proxy_id
    const encUrl = encodeURIComponent(encodeURIComponent(img.path));
    const imageUrl = `${api.baseUrl}/imageproxy?path=${encUrl}&provider=${img.provider}&checksum=${checksum}`;
    if (normalizedSize) return imageUrl + `&size=${normalizedSize}`;
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
  lightColor: string;
  darkColor: string;
}

const _rgbTupleToHex = (rgb: RGBColor | null | undefined): string => {
  if (!rgb) return "";
  return rgbToHex(rgb);
};

export const EMPTY_COLOR_PALETTE: ImageColorPalette = {
  lightColor: "",
  darkColor: "",
};

export function paletteFromServer(
  palette: MediaItemPalette | null | undefined,
): ImageColorPalette {
  if (!palette) return { ...EMPTY_COLOR_PALETTE };
  return {
    lightColor: _rgbTupleToHex(palette.on_dark),
    darkColor: _rgbTupleToHex(palette.on_light),
  };
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

export function getValueFromSources<T>(
  isAvailable: T | undefined,
  sources: [boolean, T, T?][],
): T | undefined {
  if (isAvailable) {
    return isAvailable;
  }

  for (const source of sources) {
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
      breakpoint: "bp5",
      condition: "lt",
    })
  ) {
    return 3;
  } else if (
    getBreakpointValue({
      breakpoint: "bp5",
      condition: "gt",
    }) &&
    getBreakpointValue({
      breakpoint: "bp6",
      condition: "lt",
    })
  ) {
    return 3;
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
    return 4;
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
    return 5;
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
    return 6;
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
    }) &&
    getBreakpointValue({
      breakpoint: "bp11",
      condition: "lt",
    })
  ) {
    return 9;
  } else if (
    getBreakpointValue({
      breakpoint: "bp11",
      condition: "gt",
    })
  ) {
    return 10;
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

  // Modern Clipboard API: only available in secure contexts (HTTPS / localhost).
  if (window.isSecureContext && navigator.clipboard?.writeText) {
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

  // Fallback for non-secure contexts. Append inside the active dialog (if any)
  // so a focus trap (e.g. Reka UI Dialog) does not steal focus and clear the
  // textarea's selection before execCommand("copy") runs.
  const host =
    document.activeElement?.closest<HTMLElement>("[role=dialog]") ??
    document.body;
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.width = "1px";
  textArea.style.height = "1px";
  textArea.style.opacity = "0";
  textArea.style.pointerEvents = "none";
  host.appendChild(textArea);
  try {
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    return false;
  } finally {
    host.removeChild(textArea);
  }
}

export const isBuiltinPlayer = function (player: Player): boolean {
  return (
    player.player_id === webPlayer.player_id ||
    player.player_id === store.companionPlayerId ||
    player.output_protocols?.filter(
      (x) =>
        x.output_protocol_id === webPlayer.player_id ||
        x.output_protocol_id === store.companionPlayerId,
    ).length > 0
  );
};

export const playerVisible = function (
  player: Player,
  allowGroupChilds = false,
): boolean {
  // perform some basic checks if we may use/show the player
  if (!player.enabled) return false;
  if (player.synced_to && !allowGroupChilds) {
    return false;
  }
  if (player.active_group && !allowGroupChilds) return false;
  if (!player.available) {
    return false;
  }
  if (isBuiltinPlayer(player)) {
    return true;
  }
  if (player.hide_in_ui) {
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
  sortBy?: string,
) {
  // we show the play menu for the item once (if playerTip has not been dismissed)
  if (!forceMenu && store.activePlayer?.available) {
    if (
      item.media_type == MediaType.TRACK &&
      (parentItem?.media_type == MediaType.PLAYLIST ||
        parentItem?.media_type == MediaType.ALBUM) &&
      store.activePlayerQueue
    ) {
      // special case: playing a track from a playlist/album - play from here
      api.playMedia(
        parentItem.uri,
        undefined,
        false,
        item.item_id,
        undefined,
        sortBy,
      );

      return;
    }
    // else: play the item directly
    api
      .playMedia(item, undefined, undefined, undefined, undefined, sortBy)
      .then(() => {});
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
  sortBy?: string,
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
    sortBy,
  );
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
        ? (player.group_volume ?? 0)
        : player.volume_level || 0;

  if (volume === 0) {
    return Volume;
  } else if (volume < 50) {
    return Volume1;
  } else {
    return Volume2;
  }
};
