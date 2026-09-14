import { ProviderType } from "@/plugins/api/interfaces";

/**
 * Step model and orchestration for the onboarding wizard.
 *
 * Onboarding runs on two tracks: the admin sets the server up, and everyone
 * else who lives here is welcomed into it. Both are one registry of steps here.
 *
 * Everything in here is pure: a step decides whether it applies and whether it
 * is done from the context it is handed, never from the api or the router. The
 * composable (`@/composables/useOnboarding`) builds that context from live
 * state and the wizard page renders whatever this module returns.
 */

export type OnboardingStepId =
  // the admin track: setting the server up
  | "intent"
  | "music_sources"
  | "players"
  | "plugins"
  | "core_settings"
  | "invite_members"
  | "finish"
  // the member track: being welcomed into a server someone else set up
  | "welcome"
  | "whats_here"
  | "tour"
  | "all_set";

export type OnboardingIntent = "phone_apps" | "music_hub";

/** How much of the player a member wants to see, as the welcome asks it. */
export type OnboardingPersona = "enthusiast" | "regular";

/**
 * The preferences a persona seeds. Nothing reads the persona itself: the
 * answer only decides what these are set to, once, and every one of them stays
 * a setting the member can change afterwards.
 */
export const PERSONA_DEFAULTS: Readonly<
  Record<OnboardingPersona, Readonly<Record<string, boolean>>>
> = {
  // the waveform progress bar and the background visualizer of the full player
  enthusiast: { show_waveform: true, visualizer_enabled: true },
  regular: { show_waveform: false, visualizer_enabled: false },
};

/** A configured provider, reduced to what the steps need. */
export interface OnboardingProvider {
  type: ProviderType;
  domain: string;
  builtin: boolean;
  // switched off in its configuration: set up all the same, so it still ticks
  // its step off, but the wizard flags it
  enabled: boolean;
}

export interface OnboardingAnswers {
  intent?: OnboardingIntent;
  persona?: OnboardingPersona;
}

export interface OnboardingContext {
  isAdmin: boolean;
  // someone who lives here without running the place: a signed-in household
  // member who is not on the admin track. Never both, so the two tracks never
  // run into each other
  isMember: boolean;
  // the welcome has been shown to this member before, whatever they made of it
  welcomed: boolean;
  providers: OnboardingProvider[];
  playerCount: number;
  // the household members: everyone with an account of their own, so neither
  // the Home Assistant system account nor a guest or service one. `null` until
  // the users are in, so nothing is decided on a household nobody asked for
  memberCount: number | null;
  answers: OnboardingAnswers;
}

/**
 * What a step is there for: something to do, something to look over, or the
 * summary that rounds the wizard off. A review is never a to-do — it is not
 * counted, not listed as pending and never stands between the user and the
 * finish — but the wizard does walk them past it.
 */
export type OnboardingStepKind = "step" | "review" | "summary";

export interface OnboardingStep {
  id: OnboardingStepId;
  kind: OnboardingStepKind;
  // optional by nature: the wizard offers it, the checklist never asks for it
  optional?: boolean;
  // a core step the answers pushed to the back: it stops blocking the wizard,
  // but it stays on the checklist, which is the whole point of deferring it
  // rather than dropping it
  deferred?: boolean;
  appliesTo(ctx: OnboardingContext): boolean;
  isDone(ctx: OnboardingContext): boolean;
}

/**
 * A provider of this type that the user set up themselves. Builtin providers
 * ship with the server, so they say nothing about what was configured.
 */
function hasConfiguredProvider(
  ctx: OnboardingContext,
  type: ProviderType,
): boolean {
  return ctx.providers.some(
    (provider) => provider.type === type && !provider.builtin,
  );
}

// Which track a step belongs to. Every step is on exactly one of them, and a
// context is only ever on one, so the two never mix in a single run.
const onAdminTrack = (ctx: OnboardingContext) => ctx.isAdmin;
const onMemberTrack = (ctx: OnboardingContext) => ctx.isMember;

/**
 * A step that can be ticked off. The review steps and the summary are there to
 * be walked past, so they are never pending, never counted and never asked for
 * — and never skipped over either, which is what the wizard reads this for.
 */
export const isTodo = (step: OnboardingStep): boolean => step.kind === "step";

/** Both tracks, each in its base order. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "intent",
    kind: "step",
    appliesTo: onAdminTrack,
    isDone: (ctx) => ctx.answers.intent != null,
  },
  {
    id: "music_sources",
    kind: "step",
    appliesTo: onAdminTrack,
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.MUSIC),
  },
  {
    id: "players",
    kind: "step",
    appliesTo: onAdminTrack,
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.PLAYER),
  },
  {
    id: "plugins",
    kind: "step",
    optional: true,
    appliesTo: onAdminTrack,
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.PLUGIN),
  },
  {
    id: "core_settings",
    kind: "review",
    appliesTo: onAdminTrack,
    // nothing to tick off: the server ships with settings that work, so there
    // is never anything missing here. What keeps the wizard from walking past
    // this step is its kind, not this answer.
    isDone: () => false,
  },
  {
    id: "invite_members",
    kind: "step",
    optional: true,
    appliesTo: onAdminTrack,
    // done once the household is more than the admin setting it up; not
    // knowing who is in it is not the same as nobody else being in it
    isDone: (ctx) => ctx.memberCount != null && ctx.memberCount > 1,
  },
  {
    id: "finish",
    kind: "summary",
    // the summary is the end of the track, never something to tick off
    appliesTo: onAdminTrack,
    isDone: () => false,
  },
  {
    id: "welcome",
    kind: "step",
    appliesTo: onMemberTrack,
    // the one thing the welcome asks for: how much of the player they want to
    // see. Everything after it is there to be looked at, not filled in.
    // Having been shown it is enough: nobody is asked to answer a question
    // they have already been put in front of and walked away from.
    isDone: (ctx) => ctx.answers.persona != null || ctx.welcomed,
  },
  {
    id: "whats_here",
    kind: "review",
    appliesTo: onMemberTrack,
    isDone: () => false,
  },
  {
    id: "tour",
    kind: "review",
    appliesTo: onMemberTrack,
    isDone: () => false,
  },
  {
    id: "all_set",
    kind: "summary",
    appliesTo: onMemberTrack,
    isDone: () => false,
  },
];

/**
 * Apply the answers to the running order. Answers only reorder and de-emphasize
 * steps, they never take one away: someone who came for the players can still
 * add a music source from the same wizard. Only the admin track has anything
 * to reorder, so the member track comes back exactly as it went in.
 */
export function orderSteps(
  steps: readonly OnboardingStep[],
  answers: OnboardingAnswers,
): OnboardingStep[] {
  if (answers.intent !== "phone_apps") return [...steps];

  const musicSources = steps.find((step) => step.id === "music_sources");
  if (!musicSources) return [...steps];

  // streaming from phone apps works without a music source in Music Assistant,
  // so it moves behind the plugins and stops blocking the finish
  const ordered = steps.filter((step) => step.id !== "music_sources");
  ordered.splice(deferredIndex(ordered), 0, {
    ...musicSources,
    deferred: true,
  });
  return ordered;
}

/** Where a deferred step goes: behind the plugins, but before the review. */
function deferredIndex(steps: OnboardingStep[]): number {
  const pluginsIndex = steps.findIndex((step) => step.id === "plugins");
  if (pluginsIndex !== -1) return pluginsIndex + 1;
  // nothing to sit behind: stay ahead of the first step that is nothing to do,
  // which is no place to leave something that still is
  const tailIndex = steps.findIndex((step) => !isTodo(step));
  if (tailIndex !== -1) return tailIndex;
  return steps.length;
}

/** Every step this context can see, in the order it should run in. */
export function applicableSteps(ctx: OnboardingContext): OnboardingStep[] {
  return orderSteps(
    ONBOARDING_STEPS.filter((step) => step.appliesTo(ctx)),
    ctx.answers,
  );
}

/** The steps still to do — what the wizard's summary lists. */
export function pendingSteps(ctx: OnboardingContext): OnboardingStep[] {
  return applicableSteps(ctx).filter(
    (step) => isTodo(step) && !step.isDone(ctx),
  );
}

/**
 * What the getting started checklist lists, done or not: every step that
 * applies bar the ones that are nothing to do (a review, the summary) and the
 * steps that are optional by nature, so leaving one of those alone stops the
 * checklist from asking for it forever. A deferred step stays on the list,
 * still waiting to be picked up.
 */
export function checklistSteps(ctx: OnboardingContext): OnboardingStep[] {
  return applicableSteps(ctx).filter((step) => isTodo(step) && !step.optional);
}

/** The checklist steps still to do — what its badge counts. */
export function checklistPendingSteps(
  ctx: OnboardingContext,
): OnboardingStep[] {
  return checklistSteps(ctx).filter((step) => !step.isDone(ctx));
}

/**
 * The step the wizard opens on. A requested id (`?step=`) wins as long as it
 * applies, an already done step included, and anything else falls back to the
 * first step still to do, which a review never is: the wizard walks the user
 * into one, it does not drop them in it. With nothing left to do it opens on
 * the last step of the track, which is that track's summary.
 */
export function firstStep(
  ctx: OnboardingContext,
  requestedId?: string | null,
): OnboardingStepId {
  const steps = applicableSteps(ctx);
  if (requestedId != null) {
    const requested = steps.find((step) => step.id === requestedId);
    if (requested) return requested.id;
  }
  return pendingSteps(ctx)[0]?.id ?? steps.at(-1)?.id ?? "finish";
}
