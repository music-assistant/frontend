import type { ServerInfoMessage } from "@/plugins/api/interfaces";

type IngressServerInfo = Pick<ServerInfoMessage, "homeassistant_addon">;

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
