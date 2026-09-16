/**
 * Checking, from this browser, whether the server answers on an address it
 * advertises. The address is dialled the way any device on the network would
 * dial it, so what this browser finds out is a fair sign of what the apps and
 * players in the home will find.
 */

/** What checking an address from this browser found out. */
export type AddressCheck =
  | "checking"
  | "reachable"
  | "unreachable"
  | "unchecked";

// how long an address gets to answer before it counts as not answering
const PROBE_TIMEOUT_MS = 5000;

/**
 * Check whether the server answers on an address.
 *
 * :param url: The address as the server advertises it, without a trailing slash.
 * :param serverId: The id of the server the address should lead to.
 * :return: "reachable" when the address answered as this very server,
 *   "unreachable" when it did not answer in time, answered with an error or
 *   answered as another server, and "unchecked" when this page could not try:
 *   a page served over https may not fetch plain http (mixed content).
 */
export async function probeServerAddress(
  url: string,
  serverId: string,
): Promise<AddressCheck> {
  if (window.location.protocol === "https:" && url.startsWith("http:")) {
    return "unchecked";
  }
  try {
    // both the webserver and the stream server answer /info from any origin
    const response = await fetch(`${url}/info`, {
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (!response.ok) return "unreachable";
    const info: { server_id?: unknown } = await response.json();
    return info.server_id === serverId ? "reachable" : "unreachable";
  } catch {
    return "unreachable";
  }
}
