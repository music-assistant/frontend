export type ConnectionIdentity = `local:${string}` | `remote:${string}`;

export function createLocalConnectionIdentity(
  address: string | null | undefined,
): ConnectionIdentity | undefined {
  if (!address) return undefined;
  try {
    const url = new URL(address);
    const path = url.pathname.replace(/\/+$/, "");
    return `local:${url.protocol}//${url.host}${path}`;
  } catch {
    return undefined;
  }
}

export function createRemoteConnectionIdentity(
  remoteId: string | null | undefined,
): ConnectionIdentity | undefined {
  if (!remoteId) return undefined;
  const normalized = remoteId.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.length === 26 ? `remote:${normalized}` : undefined;
}
