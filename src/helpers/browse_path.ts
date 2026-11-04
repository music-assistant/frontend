import { DISCOVER_BROWSE_SCHEME } from "./discover_browse";

/**
 * The browse path of a folder's parent: the provider's root for a top-level folder,
 * and `root` (the list of providers) for a provider's root itself.
 *
 * A Discover row is a single level under its provider, so its parent is the
 * provider's level even when the row id carries slashes of its own.
 *
 * @param path - A browse path, e.g. `filesystem_local--abc://Rock/Classic`.
 */
export function parentBrowsePath(path: string): string {
  const separatorIndex = path.indexOf("://");
  const prefixLength = separatorIndex < 0 ? 0 : separatorIndex + 3;
  const subPath = path.slice(prefixLength);
  // a provider's own level is listed at the browse root
  if (!subPath) return "root";
  if (path.slice(0, separatorIndex) === DISCOVER_BROWSE_SCHEME) {
    const [rowProvider, ...rowIdParts] = subPath.split("/");
    if (!rowProvider) return "root";
    if (rowIdParts.length) return path.slice(0, prefixLength) + rowProvider;
  }
  return (
    path.slice(0, prefixLength) + subPath.split("/").slice(0, -1).join("/")
  );
}

/** What a breadcrumb level of a browse path stands for. */
export type BrowsePathLevelKind = "scheme" | "provider" | "folder" | "row";

/** One breadcrumb level of a browse path. */
export interface BrowsePathLevel {
  /** What the level stands for: the scheme, a provider, a folder or a Discover row. */
  kind: BrowsePathLevelKind;
  /** The browse path that lists this level. */
  path: string;
  /** The folder name, provider instance id or row id the level stands for. */
  segment: string;
  /** The provider part of the path, empty when the path carries none. */
  provider: string;
}

/**
 * Split a browse path into the levels its breadcrumb shows.
 *
 * A regular path reads as `<provider>://<folder>/<folder>`, one level per folder.
 * A Discover path reads as `discover://<provider>/<row id>`, where everything after
 * the provider is the row id, slashes and all.
 *
 * @param path - The browse path, e.g. `deezer--abc://albums` or `discover://recs/row`.
 * @returns The levels, outermost first; empty for a path without a provider.
 */
export const browsePathLevels = (path: string): BrowsePathLevel[] => {
  const [provider, folderPart = ""] = path.includes("://")
    ? path.split("://")
    : ["", path];
  if (!provider) {
    // a path without a provider reads as a plain folder tree
    const segments = folderPart.split("/").filter(Boolean);
    return segments.map((segment, index) => ({
      kind: "folder" as const,
      path: segments.slice(0, index + 1).join("/"),
      segment,
      provider,
    }));
  }

  const prefix = `${provider}://`;
  if (provider === DISCOVER_BROWSE_SCHEME) {
    const levels: BrowsePathLevel[] = [
      { kind: "scheme", path: prefix, segment: provider, provider },
    ];
    const [rowProvider, ...rowIdParts] = folderPart.split("/").filter(Boolean);
    if (!rowProvider) return levels;
    levels.push({
      kind: "provider",
      path: `${prefix}${rowProvider}`,
      segment: rowProvider,
      provider,
    });
    // a row id keeps its own slashes, so it is one level rather than a tree
    const rowId = rowIdParts.join("/");
    if (rowId) {
      levels.push({
        kind: "row",
        path: `${prefix}${rowProvider}/${rowId}`,
        segment: rowId,
        provider,
      });
    }
    return levels;
  }

  const levels: BrowsePathLevel[] = [
    { kind: "provider", path: prefix, segment: provider, provider },
  ];
  const folders = folderPart.split("/").filter(Boolean);
  folders.forEach((segment, index) => {
    levels.push({
      kind: "folder",
      path: prefix + folders.slice(0, index + 1).join("/"),
      segment,
      provider,
    });
  });
  return levels;
};
