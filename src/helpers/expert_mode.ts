import type { OnboardingIntent } from "@/helpers/onboarding";
import {
  isAdminTrack,
  ONBOARDING_INTENT_PREFERENCE,
} from "@/helpers/onboarding_access";
import { store } from "@/plugins/store";

/**
 * The expert experience, as the one setting the welcome asks for.
 *
 * Whoever never answered gets the experience that fits their account: the
 * expert one for an admin, unless their setup was for the phone apps alone,
 * and the standard one for everyone else, a guest or a dashboard session with
 * no account of its own included. The display settings that come with the
 * expert experience follow this flag until the user sets them by hand.
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
 * Whether the signed-in user is on the expert experience: the flag when they
 * set it, else their default. Reads reactive store state, so it stays reactive
 * inside a computed.
 */
export function expertMode(): boolean {
  const flag = store.currentUser?.preferences?.[EXPERT_MODE_PREFERENCE];
  return flag == null ? defaultExpertMode() : Boolean(flag);
}

/**
 * The expert mode the signed-in user is on until they set the flag: what an
 * earlier welcome answered, else on for an admin whose setup was not for the
 * phone apps alone.
 */
export function defaultExpertMode(): boolean {
  const preferences = store.currentUser?.preferences;
  const intent = preferences?.[ONBOARDING_INTENT_PREFERENCE] as
    OnboardingIntent | undefined;
  return (
    expertModeOf(undefined, preferences?.[LEGACY_PERSONA_PREFERENCE]) ??
    (isAdminTrack() && intent !== "phone_apps")
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
