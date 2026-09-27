import { api } from "@/plugins/api";
import {
  EventType,
  type EventMessage,
  type FavoriteUpdate,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";

interface FavoriteHolder {
  favorite: boolean | null;
}

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
  if (!holdsFavorite(incoming) || !holdsFavorite(current)) return incoming;
  return { ...incoming, favorite: current.favorite };
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

function holdsFavorite(value: unknown): value is FavoriteHolder {
  return typeof value === "object" && value !== null && "favorite" in value;
}
