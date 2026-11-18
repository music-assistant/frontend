import { ApiCommandError } from "@/plugins/api/errors";
import {
  type NetworkShareSettings,
  ShareType,
  StorageKind,
  type StorageLocation,
  StorageUsage,
} from "@/plugins/api/interfaces";
import { $t, canonicalizeLocale } from "@/plugins/i18n";
import { Container, Folder, HardDrive, House, Network, Usb } from "@lucide/vue";
import type { Component } from "vue";

/** The icon of each kind of storage location. */
export const STORAGE_KIND_ICONS: Record<StorageKind, Component> = {
  [StorageKind.BUILTIN_MEDIA]: House,
  [StorageKind.CONTAINER_VOLUME]: Container,
  [StorageKind.NETWORK_SHARE]: Network,
  [StorageKind.REMOVABLE]: Usb,
  [StorageKind.LOCAL_DISK]: HardDrive,
  [StorageKind.MANUAL]: Folder,
};

/** The translation key of the label of each kind of storage location. */
export const STORAGE_KIND_LABEL_KEYS: Record<StorageKind, string> = {
  [StorageKind.BUILTIN_MEDIA]: "settings.storage.kind.builtin_media",
  [StorageKind.CONTAINER_VOLUME]: "settings.storage.kind.container_volume",
  [StorageKind.NETWORK_SHARE]: "settings.storage.kind.network_share",
  [StorageKind.REMOVABLE]: "settings.storage.kind.removable",
  [StorageKind.LOCAL_DISK]: "settings.storage.kind.local_disk",
  [StorageKind.MANUAL]: "settings.storage.kind.manual",
};

/** The translation key of the name of each type of network share. */
export const SHARE_TYPE_LABEL_KEYS: Record<ShareType, string> = {
  [ShareType.CIFS]: "settings.storage.share_type.cifs",
  [ShareType.NFS]: "settings.storage.share_type.nfs",
};

/** A folder inside a storage location: the location plus the subfolders leading to it. */
export interface StoragePosition {
  location: StorageLocation;
  segments: string[];
}

/** What the network share dialog edits; empty strings stand for "not set". */
export interface NetworkShareForm {
  shareType: ShareType;
  server: string;
  share: string;
  username: string;
  password: string;
  // null is automatic
  version: string | null;
  readOnly: boolean;
}

/**
 * The absolute path of a subfolder of a storage location.
 *
 * @param root - The path of the storage location.
 * @param segments - The names of the subfolders leading from the location to the folder.
 */
export function joinStoragePath(
  root: string,
  segments: readonly string[],
): string {
  const base = root.length > 1 ? root.replace(/\/+$/, "") : root;
  if (segments.length === 0) return base;
  return `${base === "/" ? "" : base}/${segments.join("/")}`;
}

/**
 * A path in the one form paths are compared in: a run of slashes counts as one and a
 * trailing slash is dropped, while the root stays `/`. Only for comparing; a stored
 * path is kept exactly as it is.
 *
 * @param path - The path to normalise, e.g. `/media//music/` into `/media/music`.
 */
export function normalizeStoragePath(path: string): string {
  const collapsed = path.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/$/, "") : collapsed;
}

/** Whether two paths name the same folder; a missing path matches nothing. */
export const sameStoragePath = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean => !!a && !!b && normalizeStoragePath(a) === normalizeStoragePath(b);

/**
 * Whether a path lies inside a folder, below it rather than being the folder itself.
 *
 * @param path - The path that may lie inside, e.g. `/media/music/Albums`.
 * @param folder - The folder it may lie in, e.g. `/media/music`.
 */
export function isInsideStoragePath(path: string, folder: string): boolean {
  const inner = normalizeStoragePath(path);
  const outer = normalizeStoragePath(folder);
  return inner !== outer && inner.startsWith(storagePathPrefix(outer));
}

/**
 * A path cut into the pieces a line may break between: every piece but the last ends
 * with its slash, and a leading slash stays with the first name.
 *
 * @param path - The path to cut, e.g. `/media/music` into `/media/` and `music`.
 */
export function pathParts(path: string): string[] {
  const parts = path.match(/[^/]*\/+|[^/]+$/g) ?? [];
  const [first, second, ...rest] = parts;
  if (first !== undefined && second !== undefined && /^\/+$/.test(first)) {
    return [first + second, ...rest];
  }
  return parts;
}

/**
 * The storage location holding a folder, and the subfolders leading to it.
 *
 * The innermost location wins when locations are nested. A path that lies in no
 * location gives null.
 *
 * @param locations - The storage locations to look in.
 * @param path - The absolute path of the folder.
 */
export function findStoragePosition(
  locations: readonly StorageLocation[],
  path: string,
): StoragePosition | null {
  const target = normalizeStoragePath(path);
  let best: StoragePosition | null = null;
  let bestRoot = "";
  for (const location of locations) {
    const root = normalizeStoragePath(location.path);
    const prefix = storagePathPrefix(root);
    if (target !== root && !target.startsWith(prefix)) continue;
    if (best && bestRoot.length >= root.length) continue;
    const rest = target === root ? "" : target.slice(prefix.length);
    best = { location, segments: rest.split("/").filter(Boolean) };
    bestRoot = root;
  }
  return best;
}

/**
 * A size in gigabytes (as the server reports it), in the unit that reads best. A size
 * above zero never reads as zero.
 *
 * @param gigabytes - The size in gigabytes of 1024 megabytes.
 * @param locale - The locale to format the number for.
 */
export function formatStorageSize(gigabytes: number, locale: string): string {
  const [value, unit] =
    gigabytes >= 1024
      ? [gigabytes / 1024, "terabyte"]
      : gigabytes >= 1
        ? [gigabytes, "gigabyte"]
        : [gigabytes * 1024, "megabyte"];
  // below one, a fixed number of decimals would round a small size away
  const digits: Intl.NumberFormatOptions =
    value > 0 && value < 1
      ? { maximumSignificantDigits: 1 }
      : { maximumFractionDigits: value >= 100 ? 0 : 1 };
  return new Intl.NumberFormat(canonicalizeLocale(locale), {
    style: "unit",
    unit,
    ...digits,
  }).format(value);
}

/**
 * Names as one list the way the language writes it, e.g. "A, B and C".
 *
 * @param names - The names to list.
 * @param locale - The locale to list them for.
 */
export function formatNames(names: readonly string[], locale: string): string {
  return new Intl.ListFormat(canonicalizeLocale(locale), {
    style: "long",
    type: "conjunction",
  }).format(names);
}

/** A network share Music Assistant mounted and manages. */
export type ManagedShareLocation = StorageLocation & {
  share_name: string;
  share_type: ShareType;
};

/**
 * Whether the location is named after its kind: the media folder of Home Assistant,
 * which a kind badge would only repeat.
 */
export const isNamedByKind = (location: StorageLocation): boolean =>
  location.usage === StorageUsage.MEDIA &&
  location.kind === StorageKind.BUILTIN_MEDIA;

/**
 * The name to show for a location. The rows whose role is fixed (the Home Assistant
 * media folder and the server's own data and cache) are named here, in the user's
 * language; every other location keeps the name the server gave it.
 */
export function storageLocationName(location: StorageLocation): string {
  if (location.usage === StorageUsage.DATA) {
    return $t("settings.storage.usage.data");
  }
  if (location.usage === StorageUsage.CACHE) {
    return $t("settings.storage.usage.cache");
  }
  if (isNamedByKind(location))
    return $t(STORAGE_KIND_LABEL_KEYS[location.kind]);
  return location.name;
}

/**
 * The music sources a location names under "Used by". The server lists a source on
 * every location that holds its folder; a row names it only on the innermost of those,
 * so a source shows once, also when another source has the same name.
 *
 * @param location - The location whose row is shown.
 * @param locations - Every location the page lists.
 */
export function usedByShownOn(
  location: StorageLocation,
  locations: readonly StorageLocation[],
): string[] {
  const inner = locations.filter((other) =>
    isInsideStoragePath(other.path, location.path),
  );
  // a location inside another lists only sources that one lists too
  const outermost = inner.filter(
    (other) =>
      !inner.some((around) => isInsideStoragePath(other.path, around.path)),
  );
  const shown = [...location.used_by];
  for (const name of outermost.flatMap((other) => other.used_by)) {
    const index = shown.indexOf(name);
    if (index !== -1) shown.splice(index, 1);
  }
  return shown;
}

/**
 * Whether a location can hold a music source of its own: an available music location
 * that no source reads yet, neither from a folder inside it nor through a folder
 * around it, so a source on it overlaps no other.
 */
export const canHoldNewSource = (location: StorageLocation): boolean =>
  location.usage === StorageUsage.MEDIA &&
  location.available &&
  location.used_by.length === 0 &&
  location.read_by.length === 0;

/** Whether the location is a network share Music Assistant mounted and manages. */
export const isManagedShare = (
  location: StorageLocation,
): location is ManagedShareLocation =>
  location.managed && location.share_name !== null && !!location.share_type;

/** Whether the location is a folder an admin registered on the Storage page. */
export const isRegisteredFolder = (location: StorageLocation): boolean =>
  location.managed && location.kind === StorageKind.MANUAL;

/**
 * The address of a network share the way people write it: `//server/share` for SMB,
 * `server:/export` for NFS.
 */
export function networkShareAddress(
  shareType: ShareType,
  server: string,
  share: string,
): string {
  if (shareType === ShareType.NFS) return `${server}:${share}`;
  return `//${server}/${share}`;
}

/** An empty network share form for a new share of the given type. */
export const emptyNetworkShareForm = (
  shareType: ShareType,
): NetworkShareForm => ({
  shareType,
  server: "",
  share: "",
  username: "",
  password: "",
  version: null,
  readOnly: false,
});

/**
 * The network share form prefilled with a managed share's settings. The password is
 * never sent to the client, so it starts empty, meaning "keep the stored one".
 *
 * @param location - The managed share.
 * @param versions - The versions the server can honour for the share's type; a stored
 *   version outside them reads as automatic. Without it the stored version is kept.
 */
export const networkShareFormFromLocation = (
  location: ManagedShareLocation,
  versions?: readonly string[],
): NetworkShareForm => ({
  shareType: location.share_type,
  server: location.server ?? "",
  share: location.share ?? "",
  username: location.username ?? "",
  password: "",
  version:
    location.version !== null &&
    (!versions || versions.includes(location.version))
      ? location.version
      : null,
  readOnly: location.read_only,
});

/**
 * All settings of a network share as the dialog's form holds them, to add a share
 * with or to replace the settings of an existing one.
 *
 * A missing username (always so for NFS) is sent as null, meaning a guest, and an
 * automatic version as null. A password is only sent along with a username and when
 * one was typed; leaving it out keeps the stored one.
 */
export function networkShareSettings(
  form: NetworkShareForm,
): NetworkShareSettings {
  const username =
    form.shareType === ShareType.CIFS ? form.username.trim() || null : null;
  const settings: NetworkShareSettings = {
    server: form.server.trim(),
    share: form.share.trim(),
    username,
    version: form.version,
    read_only: form.readOnly,
  };
  if (username && form.password) settings.password = form.password;
  return settings;
}

/**
 * Whether the form holds other settings than the managed share has now, a stored
 * version the form shows as automatic included.
 */
export const networkShareFormChanged = (
  location: ManagedShareLocation,
  form: NetworkShareForm,
): boolean =>
  JSON.stringify(networkShareSettings(form)) !==
  JSON.stringify(networkShareSettings(networkShareFormFromLocation(location)));

/**
 * The reason a storage command failed: the server's own message when it sent one,
 * the fallback otherwise.
 */
export function storageErrorText(error: unknown, fallback: string): string {
  return error instanceof ApiCommandError && error.details
    ? error.details
    : fallback;
}

// the start every path inside a normalised folder has
function storagePathPrefix(folder: string): string {
  return folder === "/" ? "/" : `${folder}/`;
}
