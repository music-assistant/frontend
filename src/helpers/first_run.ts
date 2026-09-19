/**
 * The first-run setup a fresh server sends the browser to.
 *
 * A server without Home Assistant has nobody who can sign in until its first
 * admin account exists, so it sends the browser to its `/setup` page, with the
 * hand-back an external client asked for (`return_url`, `device_name`) in the
 * query when one started the sign-in. The app reads that page url once as it
 * boots and then runs from the server's own path, like on any other visit.
 */

/** What the setup page url carries for the client that started the setup. */
export interface SetupEntry {
  // where to send the browser with the new token, if a client is waiting for it
  returnUrl: string | null;
  // what that client wants the token named
  deviceName: string | null;
}

const SETUP_PATH = /\/setup\/?$/;

/** The setup entry a page url carries, or null when it is not the setup page. */
export function readSetupEntry(url: URL | Location): SetupEntry | null {
  if (!SETUP_PATH.test(url.pathname)) return null;
  const params = new URLSearchParams(url.search);
  return {
    returnUrl: params.get("return_url"),
    deviceName: params.get("device_name"),
  };
}

/** The same url on the server's own path, which is where the app runs from. */
export function appUrlOf(url: URL | Location): string {
  return url.pathname.replace(SETUP_PATH, "/") + url.search + url.hash;
}
