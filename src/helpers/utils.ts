import { api } from "@/plugins/api";
import {
  Artist,
  type Audiobook,
  BrowseFolder,
  type ConfigEntry,
  ConfigEntryType,
  ImageType,
  ItemMapping,
  type MediaCollection,
  MediaItemImage,
  type MediaItemPalette,
  MediaItemType,
  MediaType,
  Player,
  PlayerConfig,
  PlayerType,
  ProviderMapping,
  QueueItem,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import DOMPurify from "dompurify";
import { marked } from "marked";

import { Volume, Volume1, Volume2, VolumeX } from "@lucide/vue";

export const isWebUrl = (url?: string | null): url is string => {
  if (!url) return false;
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
};

export const getExternalLinkUrl = (url?: string | null) => {
  if (!isWebUrl(url)) return undefined;

  const parsedUrl = new URL(url);
  const serverVersion = api.serverInfo.value?.server_version;
  if (
    (serverVersion === "0.0.0" || serverVersion?.includes("b")) &&
    parsedUrl.hostname === "music-assistant.io"
  ) {
    parsedUrl.hostname = "beta.music-assistant.io";
    return parsedUrl.toString();
  }
  return url;
};

export const openLinkInNewTab = function (url: string) {
  const target = getExternalLinkUrl(url);
  if (target) openWebUrlOnce(target);
};

export const openActionUrlEntries = (entries: ConfigEntry[]): ConfigEntry[] => {
  // Open URL-type entries returned by a config invoke_action response (one-shot).
  // Only web URLs are opened, and all URL entries are dropped from the rendered form.
  for (const entry of entries) {
    if (entry.type !== ConfigEntryType.URL) continue;
    const target = entry.value ?? entry.default_value;
    if (typeof target === "string") openWebUrlOnce(target);
  }
  return entries.filter((e) => e.type !== ConfigEntryType.URL);
};

export const openActionResultUrl = (url?: string | null) => {
  // Open the url of a config action result (one-shot).
  if (url) openWebUrlOnce(url);
};

const openWebUrlOnce = (url: string) => {
  // Open via an anchor click, which browsers treat more leniently than
  // window.open when the triggering user gesture has just expired.
  if (!isWebUrl(url)) return;
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.setAttribute("rel", "noopener");
  document.body.appendChild(a);
  a.click();
  a.remove();
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

export const getAuthorsNarratorsArray = function (
  authorsNarrators: Array<string | Artist>,
) {
  if (!authorsNarrators) return [];
  const _authorsNarrators: string[] = [];
  authorsNarrators.forEach((authorNarrator) => {
    if (typeof authorNarrator === "string") {
      _authorsNarrators.push(authorNarrator);
    } else {
      _authorsNarrators.push(authorNarrator.name);
    }
  });
  return _authorsNarrators;
};

export const getAudiobookCollectionArtists = function (
  collection: MediaCollection<Audiobook>,
  selector: (book: Audiobook) => (string | Artist)[],
): string[] {
  const artists = new Set<string>();

  collection.items.forEach((book) => {
    getAuthorsNarratorsArray(selector(book)).forEach((name) =>
      artists.add(name),
    );
  });

  return [...artists];
};

export const getBrowseFolderName = function (browseItem: BrowseFolder) {
  // The server now provides the display name and (when a resolver is active) strips
  // translation_key from the wire, so the client can no longer localize it itself: use the
  // server-provided name directly, falling back to the path for unnamed folders.
  return browseItem?.name || browseItem?.path || "";
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
  for (const provider_mapping of itemDetails.provider_mappings) {
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
  imageUrl: string | null | undefined,
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
): string {
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
      // canonical /imageproxy/<proxy_id>?size= form
      const params = new URLSearchParams();
      if (normalizedSize) params.set("size", String(normalizedSize));
      const qs = params.toString();
      return qs
        ? `${api.baseUrl}/imageproxy/${img.proxy_id}?${qs}`
        : `${api.baseUrl}/imageproxy/${img.proxy_id}`;
    }
    // legacy form, for servers on schema < 31 or images without a proxy_id
    const encUrl = encodeURIComponent(encodeURIComponent(img.path));
    const imageUrl = `${api.baseUrl}/imageproxy?path=${encUrl}&provider=${img.provider}`;
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
  return getMediaItemImageUrl(img, size);
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
      breakpoint: "bp8",
      condition: "lt",
    })
  ) {
    return 4;
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
    return 5;
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
    return 6;
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
    return 7;
  } else if (
    getBreakpointValue({
      breakpoint: "bp11",
      condition: "gt",
    })
  ) {
    return 8;
  } else {
    return 0;
  }
};

// Own instance, so the anchor rewrite below stays confined to rendered markdown
const markdownPurifier = DOMPurify();

// Send every link to a new tab (keeping the app itself loaded) and withhold the
// opener from the target page.
markdownPurifier.addHook("afterSanitizeAttributes", (node) => {
  if (node.nodeName === "A" && node.hasAttribute("href")) {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/**
 * Render markdown as sanitized HTML, safe to pass to `v-html`.
 *
 * Supports the full block syntax (lists, paragraphs, ...) and turns single
 * newlines into line breaks. Links always open in a new tab.
 *
 * @param text - Markdown source. May use escaped `\n` sequences as newlines.
 */
export const markdownToHtml = function (text: string): string {
  // some sources encode their line breaks literally; block syntax only parses on real ones
  const source = text.replaceAll("\\n", "\n").replaceAll(" \\", "\n");
  // Metadata can carry attacker-controlled HTML that reaches v-html; SANITIZE_NAMED_PROPS also blocks DOM clobbering
  return markdownPurifier.sanitize(marked(source, { breaks: true }) as string, {
    SANITIZE_NAMED_PROPS: true,
  });
};

/**
 * Copy text to the clipboard.
 *
 * :param text: The text to copy.
 * :return: Promise that resolves to true only when the text actually reached
 *   the clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Only exposed in secure contexts (https / localhost).
  if (navigator.clipboard?.writeText) {
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

  return legacyCopy(text);
}

/**
 * Copy text by selecting it and running the copy command, for contexts without
 * the Clipboard API.
 *
 * :param text: The text to copy.
 * :return: True when the text reached the clipboard.
 */
const legacyCopy = function (text: string): boolean {
  // Reka UI menus and dialogs trap focus and pull it back into themselves, which
  // clears a selection made anywhere else, so keep the node inside the trap.
  const host =
    document.activeElement?.closest<HTMLElement>(
      "[role=dialog], [role=menu]",
    ) ?? document.body;

  const node = document.createElement("span");
  node.textContent = text;
  node.setAttribute("aria-hidden", "true");
  // Browsers refuse to copy from a node they treat as not rendered, so clip it
  // out of sight instead of hiding it.
  node.style.all = "unset";
  node.style.position = "fixed";
  node.style.top = "0";
  node.style.clip = "rect(0, 0, 0, 0)";
  node.style.whiteSpace = "pre";
  // global.css disables selection on every element
  node.style.setProperty("-webkit-user-select", "text");
  node.style.userSelect = "text";

  let copied = false;
  const onCopy = function (event: ClipboardEvent) {
    event.preventDefault();
    event.clipboardData?.setData("text/plain", text);
    copied = true;
  };
  node.addEventListener("copy", onCopy);

  const selection = window.getSelection();
  host.appendChild(node);
  try {
    const range = document.createRange();
    range.selectNodeContents(node);
    selection?.removeAllRanges();
    selection?.addRange(range);
    // The command reports success even when nothing was written, so the handler
    // above is what tells us whether the text really got there.
    document.execCommand("copy");
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
  } finally {
    selection?.removeAllRanges();
    node.removeEventListener("copy", onCopy);
    host.removeChild(node);
  }

  return copied;
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
  muted = player.volume_muted ?? false,
) {
  if (muted) {
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
