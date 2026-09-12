import { type Role, Scope, UserRole } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

export interface RolePermission {
  scope: Scope;
  labelKey: string;
}

export interface RolePermissionGroup {
  titleKey: string;
  permissions: RolePermission[];
}

/** A permission a builtin role holds beyond what a custom role can get. */
export interface ExtraPermission {
  scope: string;
  // the translation key of its description, when there is one
  labelKey?: string;
}

/** The longest name a role can have. */
export const ROLE_NAME_MAX_LENGTH = 50;

/** The builtin roles a new custom role can start from, the least privileged first. */
export const ROLE_TEMPLATE_IDS: readonly string[] = [
  UserRole.GUEST,
  UserRole.USER,
];

/** What a guest may do, which every custom role may do as well. */
export const GUEST_SCOPES: readonly string[] = [
  Scope.LIBRARY_READ,
  Scope.PLAYERS_READ,
  Scope.PLAYERS_CONTROL,
  Scope.QUEUES_READ,
  Scope.QUEUES_CONTROL,
  Scope.PROVIDERS_READ,
  Scope.CONFIG_PLAYERS_READ,
];

/** The guest scopes in plain words, for the list of what a role may always do. */
export const ALWAYS_ALLOWED_PERMISSION_KEYS: readonly string[] = [
  "auth.permissions.browse_library",
  "auth.permissions.play_music",
  "auth.permissions.change_queue",
  "auth.permissions.see_sources_and_players",
];

/**
 * The scopes an admin may grant a custom role, by area. The scopes that reach
 * into accounts, the private things of other members or the server itself
 * (managing users, the whole library, all music sources, the server settings
 * and system maintenance) stay with the admin role.
 */
export const ROLE_PERMISSION_GROUPS: readonly RolePermissionGroup[] = [
  {
    titleKey: "auth.permissions.library",
    permissions: [
      {
        scope: Scope.LIBRARY_WRITE,
        labelKey: "auth.permissions.library_write",
      },
    ],
  },
  {
    titleKey: "auth.permissions.players",
    permissions: [
      {
        scope: Scope.CONFIG_PLAYERS_WRITE,
        labelKey: "auth.permissions.config_players_write",
      },
    ],
  },
  {
    titleKey: "auth.permissions.music_sources",
    permissions: [
      {
        scope: Scope.CONFIG_PROVIDERS_READ,
        labelKey: "auth.permissions.config_providers_read",
      },
      {
        scope: Scope.CONFIG_PROVIDERS_OWN,
        labelKey: "auth.permissions.config_providers_own",
      },
    ],
  },
  {
    titleKey: "auth.permissions.users",
    permissions: [
      { scope: Scope.USERS_READ, labelKey: "auth.permissions.users_read" },
      { scope: Scope.USERS_INVITE, labelKey: "auth.permissions.users_invite" },
    ],
  },
  {
    titleKey: "auth.permissions.server",
    permissions: [
      {
        scope: Scope.CONFIG_CORE_READ,
        labelKey: "auth.permissions.config_core_read",
      },
      { scope: Scope.SYSTEM_READ, labelKey: "auth.permissions.system_read" },
    ],
  },
];

/** The scopes an admin may grant a custom role. */
export const GRANTABLE_SCOPES: readonly string[] =
  ROLE_PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => permission.scope),
  );

const BUILTIN_ROLE_TRANSLATION_KEYS = new Map<string, string>([
  [UserRole.ADMIN, "auth.admin_role"],
  [UserRole.USER, "auth.user_role"],
  [UserRole.GUEST, "auth.guest_role"],
  [UserRole.SERVICE, "auth.service_role"],
]);

// a custom role holds these along with the scope that is of no use without them
const IMPLIED_SCOPES = new Map<string, readonly string[]>([
  [Scope.CONFIG_PLAYERS_WRITE, [Scope.CONFIG_PLAYERS_READ]],
  [Scope.CONFIG_PROVIDERS_OWN, [Scope.CONFIG_PROVIDERS_READ]],
]);

/**
 * The name a role is shown by: a builtin role in the language of the app, a
 * custom role by the name it was given and a role that is not listed by its id.
 *
 * @param roleId - The id of the role.
 * @param roles - The roles the server listed.
 */
export const roleDisplayName = (
  roleId: string,
  roles: readonly Role[],
): string => {
  const key = BUILTIN_ROLE_TRANSLATION_KEYS.get(roleId);
  if (key) return $t(key);
  return roles.find((role) => role.role_id === roleId)?.name ?? roleId;
};

/**
 * The roles a user can be given, in the order the server lists them. The
 * service role is meant for integrations, so it is only listed for the user
 * that holds it already.
 *
 * @param roles - The roles the server listed.
 * @param currentRoleId - The id of the role the user holds now, if any.
 */
export const assignableRoles = (
  roles: readonly Role[],
  currentRoleId?: string,
): Role[] =>
  roles.filter(
    (role) =>
      role.role_id !== UserRole.SERVICE || role.role_id === currentRoleId,
  );

/**
 * The scopes of each role, keyed by role id.
 *
 * @param roles - The roles the server listed.
 */
export const roleScopesById = (
  roles: readonly Role[],
): Record<string, string[]> =>
  Object.fromEntries(roles.map((role) => [role.role_id, role.scopes]));

/**
 * The scopes a custom role holds when it is granted the given scopes, completed
 * the way the server does: with the guest scopes and the scopes the granted ones
 * need.
 *
 * @param scopes - The scopes to grant.
 */
export const customRoleScopes = (scopes: Iterable<string>): string[] => {
  const granted = [...scopes];
  const held = new Set([...GUEST_SCOPES, ...granted]);
  for (const scope of granted) {
    for (const implied of IMPLIED_SCOPES.get(scope) ?? []) held.add(implied);
  }
  return [...held].sort();
};

/**
 * Whether another scope of the role needs the given one, which keeps it on.
 *
 * @param scopes - The scopes the role holds.
 * @param scope - The scope to check.
 */
export const isImpliedScope = (
  scopes: readonly string[],
  scope: string,
): boolean =>
  scopes.some((held) => IMPLIED_SCOPES.get(held)?.includes(scope) ?? false);

/**
 * The scopes of a custom role after turning one of them on or off. A scope
 * that another scope of the role needs stays on.
 *
 * @param scopes - The scopes the role holds.
 * @param scope - The scope to turn on or off.
 * @param enabled - Whether to turn the scope on.
 */
export const toggleScope = (
  scopes: readonly string[],
  scope: string,
  enabled: boolean,
): string[] => {
  if (enabled) return customRoleScopes([...scopes, scope]);
  if (isImpliedScope(scopes, scope)) return customRoleScopes(scopes);
  return customRoleScopes(scopes.filter((held) => held !== scope));
};

/**
 * The scopes a new custom role starts from when it is based on the given role:
 * those of its scopes a custom role can hold.
 *
 * @param role - The role to start from.
 */
export const roleTemplateScopes = (role: Role): string[] =>
  customRoleScopes(
    role.scopes.filter((scope) => GRANTABLE_SCOPES.includes(scope)),
  );

/**
 * Whether two lists hold the same scopes, in any order.
 *
 * @param a - The one list of scopes.
 * @param b - The other list of scopes.
 */
export const sameScopes = (
  a: readonly string[],
  b: readonly string[],
): boolean => {
  const held = new Set(a);
  return held.size === new Set(b).size && b.every((scope) => held.has(scope));
};

// the permissions of a builtin role that no custom role can get, in plain words
const EXTRA_PERMISSION_KEYS = new Map<string, string>([
  [Scope.USERS_IMPERSONATE, "auth.permissions.users_impersonate"],
]);

/**
 * The permissions a role holds beyond the guest scopes and those a custom role
 * can get, which only a builtin role has.
 *
 * @param scopes - The scopes the role holds.
 */
export const extraPermissions = (
  scopes: readonly string[],
): ExtraPermission[] =>
  scopes
    .filter(
      (scope) =>
        !GUEST_SCOPES.includes(scope) && !GRANTABLE_SCOPES.includes(scope),
    )
    .map((scope) => ({ scope, labelKey: EXTRA_PERMISSION_KEYS.get(scope) }));
