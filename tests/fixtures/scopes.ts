import { Scope } from "@/plugins/api/interfaces";

// the scopes the server grants its builtin roles
const GUEST_SCOPES: readonly Scope[] = [
  Scope.LIBRARY_READ,
  Scope.PLAYERS_READ,
  Scope.PLAYERS_CONTROL,
  Scope.QUEUES_READ,
  Scope.QUEUES_CONTROL,
  Scope.PROVIDERS_READ,
  Scope.CONFIG_PLAYERS_READ,
];
const MEMBER_SCOPES: readonly Scope[] = [
  ...GUEST_SCOPES,
  Scope.LIBRARY_WRITE,
  Scope.CONFIG_PROVIDERS_READ,
  Scope.CONFIG_CORE_READ,
  Scope.USERS_INVITE,
  Scope.SYSTEM_READ,
  Scope.CONFIG_PROVIDERS_OWN,
];

export const BUILTIN_ROLE_SCOPES = {
  admin: [Scope.ALL],
  user: MEMBER_SCOPES,
  guest: GUEST_SCOPES,
} satisfies Record<string, readonly Scope[]>;

// A custom role that holds a single member scope on top of the guest scopes,
// as the server reports it: managing own music sources implies reading the
// provider configs.
export const OWN_SOURCES_ROLE_SCOPES: readonly Scope[] = [
  ...GUEST_SCOPES,
  Scope.CONFIG_PROVIDERS_OWN,
  Scope.CONFIG_PROVIDERS_READ,
];

/** A scope check for a role granting the given scopes, like AuthManager.hasScope. */
export const scopeChecker =
  (scopes: readonly Scope[]) =>
  (scope: Scope): boolean =>
    scopes.includes(Scope.ALL) || scopes.includes(scope);
