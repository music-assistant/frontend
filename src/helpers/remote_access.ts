const REMOTE_APP_URL = "https://app.music-assistant.io/";

/** The web app link that opens with this remote access ID filled in. */
export function remoteAccessLink(remoteId: string): string {
  const url = new URL(REMOTE_APP_URL);
  url.searchParams.set("remote_id", remoteId);
  return url.toString();
}
