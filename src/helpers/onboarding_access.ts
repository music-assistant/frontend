import { isNewAccount } from "@/helpers/onboarding";
import { Scope, UserRole } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";

/**
 * Who onboarding has something for, and what it remembers on their account.
 *
 * This lives outside `@/composables/useOnboarding` on purpose: the router and
 * the app shell ask these questions before anything has been loaded — the
 * router while it decides whether /onboarding may even be opened — and
 * answering them must not pull in the wizard's own state, which asks the api
 * for provider configurations and leaves through the router itself. Everything
 * here reads the signed-in user and the scopes their role grants, nothing else.
 */

/** User preference holding the answer to the wizard's intent question. */
export const ONBOARDING_INTENT_PREFERENCE = "onboarding.intent";

/** User preference holding the answer to the welcome's persona question. */
export const ONBOARDING_PERSONA_PREFERENCE = "onboarding.persona";

/**
 * User preference holding when the member was welcomed, as an ISO timestamp.
 * Its presence is the whole answer: a member is welcomed once, and the app
 * never opens the welcome on them again.
 */
export const ONBOARDING_WELCOME_PREFERENCE = "onboarding.welcome";

/** The admin track: whoever sets up every kind of provider runs it. */
export const isAdminTrack = (): boolean =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE);

/**
 * The member track: someone who lives here without running the place. Their
 * account is their own, which is what tells them from a guest passing through
 * and from a service account such as the Home Assistant integration's.
 */
export const isMemberTrack = (): boolean => {
  if (isAdminTrack()) return false;
  const role = store.currentUser?.role;
  return role != null && role !== UserRole.GUEST && role !== UserRole.SERVICE;
};

/** Whether onboarding has anything for this session at all. */
export const hasOnboardingTrack = (): boolean =>
  isAdminTrack() || isMemberTrack();

/**
 * Whether the app should open the welcome by itself. It interrupts a member
 * once, right after they were given an account: anyone who has been here a
 * while is left alone, with the welcome still on the sidebar and in the
 * settings for whenever they want it.
 */
export const shouldOpenWelcome = (): boolean => {
  // the member track is only ever someone signed in, so the account is in
  const account = isMemberTrack() ? store.currentUser : undefined;
  if (!account) return false;
  const welcomedAt = account.preferences?.[ONBOARDING_WELCOME_PREFERENCE];
  return welcomedAt == null && isNewAccount(account.created_at);
};
