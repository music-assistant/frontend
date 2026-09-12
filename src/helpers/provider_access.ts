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

/** Whether the music source belongs to the given user. */
export const isOwnMusicSource = (
  config: ProviderConfig,
  userId: string | undefined,
) => userId !== undefined && config.access?.owner === userId;

export const getProviderSharingTranslationKey = (sharing: ProviderSharing) =>
  PROVIDER_SHARING_TRANSLATION_KEYS[sharing];

export const getProviderSharingHintTranslationKey = (
  sharing: ProviderSharing,
) => PROVIDER_SHARING_HINT_TRANSLATION_KEYS[sharing];

/** The users that may own a music source: enabled members, so no guests or service accounts. */
export const ownerCandidates = (users: User[]) =>
  users.filter(
    (user) =>
      user.enabled &&
      user.role !== UserRole.GUEST &&
      user.role !== UserRole.SERVICE,
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
