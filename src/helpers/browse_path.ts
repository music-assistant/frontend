/**
 * The browse path of a folder's parent: the provider's root for a top-level folder,
 * and `root` (the list of providers) for a provider's root itself.
 *
 * @param path - A browse path, e.g. `filesystem_local--abc://Rock/Classic`.
 */
export function parentBrowsePath(path: string): string {
  const separatorIndex = path.indexOf("://");
  const prefixLength = separatorIndex < 0 ? 0 : separatorIndex + 3;
  const subPath = path.slice(prefixLength);
  // a provider's own level is listed at the browse root
  if (!subPath) return "root";
  return (
    path.slice(0, prefixLength) + subPath.split("/").slice(0, -1).join("/")
  );
}
