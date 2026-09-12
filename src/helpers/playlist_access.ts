import {
  type Playlist,
  ProviderSharing,
  type User,
} from "@/plugins/api/interfaces";
import { accessAllows } from "./provider_access";

const PLAYLIST_SHARING_HINT_TRANSLATION_KEYS: Record<ProviderSharing, string> =
  {
    [ProviderSharing.PRIVATE]: "playlist_access.hints.private",
    [ProviderSharing.SELECTED]: "playlist_access.hints.selected",
    [ProviderSharing.MEMBERS]: "playlist_access.hints.members",
    [ProviderSharing.EVERYONE]: "playlist_access.hints.everyone",
  };

/** The translation key explaining a sharing choice for a playlist. */
export const getPlaylistSharingHintTranslationKey = (
  sharing: ProviderSharing,
) => PLAYLIST_SHARING_HINT_TRANSLATION_KEYS[sharing];

/** Whether the playlist is one Music Assistant keeps itself: only those carry an access record. */
export const isMusicAssistantPlaylist = (playlist: Playlist) =>
  playlist.provider_mappings.some((m) => m.provider_domain === "builtin");

/** Whether the user may change who owns and sees the playlist: a library manager, or its owner. */
export const canSharePlaylist = (
  playlist: Playlist,
  user: User | undefined,
  managesLibrary: boolean,
) =>
  isMusicAssistantPlaylist(playlist) &&
  (managesLibrary ||
    (user !== undefined && playlist.access?.owner === user.user_id));

/**
 * Whether the user may change the playlist itself, like its details or its
 * place in the library: everyone without a record, else the owner or a library
 * manager.
 */
export const canManagePlaylist = (
  playlist: Playlist,
  user: User | undefined,
  managesLibrary: boolean,
) =>
  playlist.access === null ||
  managesLibrary ||
  // without a signed-in user nobody holds the rights a record grants
  (user !== undefined && playlist.access.owner === user.user_id);

/**
 * Whether the user may add and remove items: whoever may manage the playlist,
 * and anyone it is shared with when collaborative.
 */
export const canEditPlaylistItems = (
  playlist: Playlist,
  user: User | undefined,
  managesLibrary: boolean,
) => {
  if (!playlist.is_editable) return false;
  if (canManagePlaylist(playlist, user, managesLibrary)) return true;
  const access = playlist.access;
  return (
    access !== null &&
    access.collaborative &&
    user !== undefined &&
    accessAllows(access, user)
  );
};
