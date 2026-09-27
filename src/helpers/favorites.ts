import { api } from "@/plugins/api";
import {
  EventType,
  type EventMessage,
  type FavoriteUpdate,
  type MediaItem,
  type MediaItemTypeOrItemMapping,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

interface FavoriteHolder {
  favorite?: boolean | null;
}

/** An item that can hold the signed-in user's favorite state. */
export type FavoritableItem = Extract<MediaItemTypeOrItemMapping, MediaItem>;

/**
 * Copy of an item from a media item event that keeps the favorite state the
 * caller already holds.
 *
 * A media item event carries the state of the user that triggered it, which is
 * not necessarily the signed-in one; their own changes arrive as
 * FAVORITE_UPDATED instead.
 *
 * :param incoming: The item as it arrived in the event.
 * :param current: The item the caller holds, whose favorite state is kept.
 */
export function keepOwnFavorite<T>(incoming: T, current: unknown): T {
  // an incoming item without the key carries no state to replace, and a caller
  // that holds no item of its own has none to keep
  if (!carriesFavorite(incoming) || current == null) return incoming;
  return { ...incoming, favorite: favoriteState(current) };
}

/**
 * Subscribe to the likes, dislikes and unsets of the signed-in user.
 *
 * :param onUpdate: Called for every change that belongs to the signed-in user.
 * :return: The function that ends the subscription.
 */
export function subscribeOwnFavorites(
  onUpdate: (update: FavoriteUpdate) => void,
): () => void {
  return api.subscribe(EventType.FAVORITE_UPDATED, (evt: EventMessage) => {
    const update = evt.data as FavoriteUpdate | undefined;
    // the server only sends the event to its own user, but somebody else's
    // state must never reach the screen
    if (!update || update.user_id !== store.currentUser?.user_id) return;
    onUpdate(update);
  });
}

/**
 * Translation key naming what a tap on the favorite control does next.
 *
 * :param favorite: The signed-in user's state on the item.
 */
export function favoriteActionKey(
  favorite: boolean | null | undefined,
): string {
  if (favorite === true) return "favorites_remove";
  if (favorite === false) return "favorites_dislike_remove";
  return "favorites_add";
}

/**
 * The signed-in user's state on an item: true is a like, false a dislike, null
 * nothing at all.
 *
 * :param item: The item to read the state from; a missing key reads as null.
 */
export function favoriteState(item: unknown): boolean | null {
  return (item as FavoriteHolder | null | undefined)?.favorite ?? null;
}

/**
 * Whether an item can hold a favorite state of its own.
 *
 * :param item: The item to check; an item mapping or browse folder holds none.
 */
export function canHoldFavorite(
  item: MediaItemTypeOrItemMapping,
): item is FavoritableItem {
  // the provider mappings are what an item mapping or a browse folder lacks;
  // the favorite key itself is absent whenever there is no state
  return "provider_mappings" in item;
}

/**
 * Show a state on the copy of an item the caller holds, before the server
 * confirms the change.
 *
 * :param item: The item to show it on; one that holds no state is left alone.
 * :param favorite: true for a like, false for a dislike, null for no state.
 */
export function setFavoriteState(
  item: MediaItemTypeOrItemMapping | undefined,
  favorite: boolean | null,
): void {
  if (item && canHoldFavorite(item)) item.favorite = favorite;
}

function carriesFavorite(value: unknown): value is FavoriteHolder {
  return typeof value === "object" && value !== null && "favorite" in value;
}
