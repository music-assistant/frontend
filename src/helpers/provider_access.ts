import { isSystemUser } from "@/helpers/users";
import {
  type ProviderAccess,
  type ProviderConfig,
  type ProviderManifest,
  ProviderSharing,
  ProviderType,
  type User,
  UserRole,
  type UserSummary,
} from "@/plugins/api/interfaces";

const PROVIDER_SHARING_TRANSLATION_KEYS: Record<ProviderSharing, string> = {
  [ProviderSharing.PRIVATE]: "settings.source_access.options.private",
  [ProviderSharing.SELECTED]: "settings.source_access.options.selected",
  [ProviderSharing.MEMBERS]: "settings.source_access.options.members",
  [ProviderSharing.EVERYONE]: "settings.source_access.options.everyone",
};

const PROVIDER_SHARING_HINT_TRANSLATION_KEYS: Record<ProviderSharing, string> =
  {
    [ProviderSharing.PRIVATE]: "settings.source_access.hints.private",
    [ProviderSharing.SELECTED]: "settings.source_access.hints.selected",
    [ProviderSharing.MEMBERS]: "settings.source_access.hints.members",
    [ProviderSharing.EVERYONE]: "settings.source_access.hints.everyone",
  };

/** Whether the given user may use what the access record guards, read the way the server does. */
export const accessAllows = (
  access: ProviderAccess | null,
  user: User,
): boolean => {
  if (access === null) return true;
  if (access.owner === user.user_id) return true;
  if (access.sharing === ProviderSharing.EVERYONE) return true;
  if (access.sharing === ProviderSharing.MEMBERS)
    return user.role !== UserRole.GUEST;
  if (access.sharing === ProviderSharing.SELECTED)
    return access.shared_users.includes(user.user_id);
  return false;
};

/**
 * The access a music source has, with a missing record read the way the
 * server does: a household source available to everyone.
 */
export const effectiveProviderAccess = (
  access: ProviderAccess | null,
): ProviderAccess =>
  access ?? {
    owner: null,
    sharing: ProviderSharing.EVERYONE,
    shared_users: [],
  };

/**
 * Whether the owner and sharing of a provider instance can be set: only music
 * sources carry an access record, and a builtin one always serves everyone.
 */
export const hasConfigurableAccess = (
  config: ProviderConfig,
  manifest?: ProviderManifest,
) => config.type === ProviderType.MUSIC && manifest?.builtin === false;

/**
 * Whether a member may set up (and reconfigure) a music source of the provider
 * itself; a user who manages every music source may set up any provider.
 *
 * @param manifest - The manifest of the provider.
 */
export const isSelfServiceProvider = (manifest?: ProviderManifest) =>
  // an older server sends no flag and lets a member set up any provider
  manifest?.self_service !== false;

/** Whether the music source belongs to the given user. */
export const isOwnMusicSource = (
  config: ProviderConfig,
  userId: string | undefined,
) => userId !== undefined && config.access?.owner === userId;

/**
 * Whether nobody can use what this access record guards: it has no owner and
 * is private, or is shared with selected members while nobody is picked.
 */
export const servesNobody = (access: ProviderAccess) =>
  access.owner === null &&
  (access.sharing === ProviderSharing.PRIVATE ||
    (access.sharing === ProviderSharing.SELECTED &&
      access.shared_users.length === 0));

/**
 * The translation key naming a sharing choice. Private sharing is named from
 * the viewer's side: as their own for the owner, as not shared for others.
 */
export const getProviderSharingTranslationKey = (
  sharing: ProviderSharing,
  ownedByViewer: boolean,
) =>
  sharing === ProviderSharing.PRIVATE && !ownedByViewer
    ? "settings.source_access.options.not_shared"
    : PROVIDER_SHARING_TRANSLATION_KEYS[sharing];

/**
 * The translation key explaining who can use a music source with this access.
 */
export const getProviderSharingHintTranslationKey = (
  access: ProviderAccess,
) => {
  if (servesNobody(access)) return "settings.source_access.hints.nobody";
  if (access.owner === null && access.sharing === ProviderSharing.SELECTED)
    return "settings.source_access.hints.selected_no_owner";
  return PROVIDER_SHARING_HINT_TRANSLATION_KEYS[access.sharing];
};

/**
 * The users that may own a music source: every enabled member, so neither the
 * guests nor the Home Assistant system account.
 */
export const ownerCandidates = (users: User[]) =>
  users.filter(
    (user) =>
      user.enabled && user.role !== UserRole.GUEST && !isSystemUser(user),
  );

/**
 * The users a music source can be shared with, as the server lists them to a
 * member: every enabled user but the guests, who only ever get the sources
 * shared with everyone.
 */
export const shareCandidates = (users: User[]) =>
  users.filter((user) => user.enabled && user.role !== UserRole.GUEST);

/** The name a user is shown by. */
export const userDisplayName = (user: UserSummary) =>
  user.display_name || user.username;
