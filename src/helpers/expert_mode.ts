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

// the welcome's answer as an account holds it that answered before the flag
// existed: "enthusiast" for the expert experience, "regular" otherwise
const LEGACY_PERSONA_PREFERENCE = "onboarding.persona";

/**
 * The expert mode an account's answers amount to: the flag when it is set,
 * else the persona an earlier welcome wrote, else `undefined` for an account
 * that was never asked.
 */
export function expertModeOf(
  flag: unknown,
  legacyPersona: unknown,
): boolean | undefined {
  if (flag != null) return Boolean(flag);
  if (legacyPersona == null) return undefined;
  return legacyPersona === "enthusiast";
}

/**
 * Whether the signed-in user asked for the expert experience; off until they
 * did. Reads reactive store state, so it stays reactive inside a computed.
 */
export function expertMode(): boolean {
  const preferences = store.currentUser?.preferences;
  return (
    expertModeOf(
      preferences?.[EXPERT_MODE_PREFERENCE],
      preferences?.[LEGACY_PERSONA_PREFERENCE],
    ) ?? false
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
