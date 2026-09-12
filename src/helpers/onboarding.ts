import { ProviderType } from "@/plugins/api/interfaces";

/**
 * Step model and orchestration for the admin onboarding wizard.
 *
 * Everything in here is pure: a step decides whether it applies and whether it
 * is done from the context it is handed, never from the api or the router. The
 * composable (`@/composables/useOnboarding`) builds that context from live
 * state and the wizard page renders whatever this module returns.
 */

export type OnboardingStepId =
  | "intent"
  | "music_sources"
  | "players"
  | "plugins"
  | "finish";

export type OnboardingIntent = "phone_apps" | "music_hub";

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
}

export interface OnboardingContext {
  isAdmin: boolean;
  providers: OnboardingProvider[];
  playerCount: number;
  answers: OnboardingAnswers;
}

export type OnboardingStepKind = "step" | "summary";

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

// Only the admin track exists today; every step is gated on the admin role.
const isAdminTrack = (ctx: OnboardingContext) => ctx.isAdmin;

/** The admin track, in its base order. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "intent",
    kind: "step",
    appliesTo: isAdminTrack,
    isDone: (ctx) => ctx.answers.intent != null,
  },
  {
    id: "music_sources",
    kind: "step",
    appliesTo: isAdminTrack,
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.MUSIC),
  },
  {
    id: "players",
    kind: "step",
    appliesTo: isAdminTrack,
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.PLAYER),
  },
  {
    id: "plugins",
    kind: "step",
    optional: true,
    appliesTo: isAdminTrack,
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.PLUGIN),
  },
  {
    id: "finish",
    kind: "summary",
    // the summary is the end of the track, never something to tick off
    appliesTo: isAdminTrack,
    isDone: () => false,
  },
];

/**
 * Apply the answers to the running order. Answers only reorder and de-emphasize
 * steps, they never take one away: someone who came for the players can still
 * add a music source from the same wizard.
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

/** Where a deferred step goes: behind the plugins, but before the summary. */
function deferredIndex(steps: OnboardingStep[]): number {
  const pluginsIndex = steps.findIndex((step) => step.id === "plugins");
  if (pluginsIndex !== -1) return pluginsIndex + 1;
  const finishIndex = steps.findIndex((step) => step.id === "finish");
  if (finishIndex !== -1) return finishIndex;
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
    (step) => step.kind !== "summary" && !step.isDone(ctx),
  );
}

/**
 * What the getting started checklist lists, done or not: every step that
 * applies bar the summary and the steps that are optional by nature, so
 * leaving one of those alone stops the checklist from asking for it forever. A
 * deferred step stays on the list, still waiting to be picked up.
 */
export function checklistSteps(ctx: OnboardingContext): OnboardingStep[] {
  return applicableSteps(ctx).filter(
    (step) => step.kind !== "summary" && !step.optional,
  );
}

/** The checklist steps still to do — what its badge counts. */
export function checklistPendingSteps(
  ctx: OnboardingContext,
): OnboardingStep[] {
  return checklistSteps(ctx).filter((step) => !step.isDone(ctx));
}

/**
 * The step the wizard opens on. A requested id (`?step=`) wins as long as it
 * applies — including an already done step, so the checklist can link back to
 * one — and anything else falls back to the first step still to do.
 */
export function firstStep(
  ctx: OnboardingContext,
  requestedId?: string | null,
): OnboardingStepId {
  if (requestedId != null) {
    const requested = applicableSteps(ctx).find(
      (step) => step.id === requestedId,
    );
    if (requested) return requested.id;
  }
  return pendingSteps(ctx)[0]?.id ?? "finish";
}
