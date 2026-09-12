import type { User } from "@/plugins/api/interfaces";

/** Username of the Home Assistant integration's system account. */
export const HOMEASSISTANT_SYSTEM_USER = "homeassistant_system";

/** Whether the user is the Home Assistant integration's system account. */
export const isSystemUser = (user: User): boolean =>
  user.username === HOMEASSISTANT_SYSTEM_USER;
