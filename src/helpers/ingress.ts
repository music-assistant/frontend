import type { ServerInfoMessage } from "@/plugins/api/interfaces";

type IngressServerInfo = Pick<ServerInfoMessage, "homeassistant_addon">;

const INGRESS_CLIENT_KEY_STORAGE_KEY = "ingress_client_key";
const INGRESS_CLIENT_KEY_BYTES = 16;

export function hasHomeAssistantIngressPath(): boolean {
  return window.location.pathname.includes("/hassio_ingress/");
}

export function isHomeAssistantIngressSession(
  serverInfo?: IngressServerInfo | null,
): boolean {
  return (
    hasHomeAssistantIngressPath() && serverInfo?.homeassistant_addon === true
  );
}

/**
 * Return the key this browser identifies itself with over Home Assistant Ingress.
 *
 * Created on first use and shared by all tabs, so the server can link the web
 * player of this browser to its API connections.
 */
export function getIngressClientKey(): string {
  let key = localStorage.getItem(INGRESS_CLIENT_KEY_STORAGE_KEY);
  if (!key) {
    // not crypto.randomUUID, which needs a secure context (https)
    key = Array.from(
      crypto.getRandomValues(new Uint8Array(INGRESS_CLIENT_KEY_BYTES)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    localStorage.setItem(INGRESS_CLIENT_KEY_STORAGE_KEY, key);
  }
  return key;
}
