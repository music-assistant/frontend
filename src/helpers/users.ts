import type { User } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

/** Username of the Home Assistant integration's system account. */
export const HOMEASSISTANT_SYSTEM_USER = "homeassistant_system";

/** Whether the user is the Home Assistant integration's system account. */
export const isSystemUser = (user: User): boolean =>
  user.username === HOMEASSISTANT_SYSTEM_USER;

/**
 * What a role is called. A server can carry a role this frontend has no name
 * for, and an unknown key is handed straight back by `$t`, so the role stands
 * in for itself rather than a translation key nobody can read.
 */
export const roleLabel = (role: string): string => {
  const key = `auth.${role}_role`;
  const label = $t(key);
  return label === key ? role : label;
};
