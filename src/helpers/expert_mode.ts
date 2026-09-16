import { store } from "@/plugins/store";

/**
 * The expert experience, as the one setting the welcome asks for.
 *
 * The app starts out simple: whoever never answered gets the standard
 * experience, and so does a guest or a dashboard session with no account of
 * its own. The display settings that come with the expert experience follow
 * this flag until the user sets them by hand.
 */

/** User preference holding whether this user asked for the expert experience. */
export const EXPERT_MODE_PREFERENCE = "expert_mode";

/**
 * Whether the signed-in user asked for the expert experience; off until they
 * did. Reads reactive store state, so it stays reactive inside a computed.
 */
export function expertMode(): boolean {
  return Boolean(
    store.currentUser?.preferences?.[EXPERT_MODE_PREFERENCE] ?? false,
  );
}

/**
 * A boolean display setting that follows the expert mode until the user sets
 * it themselves: on for the expert, off for everyone else.
 */
export function expertModeSetting(key: string): boolean {
  const value = store.currentUser?.preferences?.[key];
  return value == null ? expertMode() : Boolean(value);
}
