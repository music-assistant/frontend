import { getProviderStatusTranslationKey } from "@/helpers/provider_config";
import { ProviderType, type ProviderStatus } from "@/plugins/api/interfaces";

/**
 * Step model and orchestration for the onboarding wizard, in which the admin
 * sets the server up.
 *
 * Everything in here is pure: a step decides whether it is done from the
 * context it is handed, never from the api or the router. The composable
 * (`@/composables/useOnboarding`) builds that context from live state and the
 * wizard renders whatever this module returns.
 */

export type OnboardingStepId =
  | "intent"
  | "music_sources"
  | "players"
  | "plugins"
  | "core_settings"
  | "finish";

export type OnboardingIntent = "phone_apps" | "music_hub";

/** How the wizard leaves a step: moving on, or pausing the setup. */
export interface StepLeaveOptions {
  pausing?: boolean;
}

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
  providers: OnboardingProvider[];
  playerCount: number;
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
  // optional by nature: the wizard offers a skip instead of a Next
  optional?: boolean;
  // a core step the answers pushed to the back: it no longer leads the wizard
  // and offers a skip, but stays listed as still to do rather than dropped
  deferred?: boolean;
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

/**
 * A step that can be ticked off. The review steps and the summary are there to
 * be walked past, so they are never pending, never counted and never asked for
 * — and never skipped over either, which is what the wizard reads this for.
 */
export const isTodo = (step: OnboardingStep): boolean => step.kind === "step";

export const attentionLabelKey = (status: ProviderStatus | null) =>
  status
    ? getProviderStatusTranslationKey(status)
    : "onboarding.needs_attention";

/** The steps of the setup, in their base order. */
export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    id: "intent",
    kind: "step",
    isDone: (ctx) => ctx.answers.intent != null,
  },
  {
    id: "music_sources",
    kind: "step",
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.MUSIC),
  },
  {
    id: "players",
    kind: "step",
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.PLAYER),
  },
  {
    id: "plugins",
    kind: "step",
    optional: true,
    isDone: (ctx) => hasConfiguredProvider(ctx, ProviderType.PLUGIN),
  },
  {
    id: "core_settings",
    kind: "review",
    // nothing to tick off: the server ships with settings that work, so there
    // is never anything missing here. What keeps the wizard from walking past
    // this step is its kind, not this answer.
    isDone: () => false,
  },
  {
    id: "finish",
    kind: "summary",
    // the summary is the end of the setup, never something to tick off
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

/** Every step of the setup, in the order it should run in. */
export function applicableSteps(ctx: OnboardingContext): OnboardingStep[] {
  return orderSteps(ONBOARDING_STEPS, ctx.answers);
}

/** The steps still to do — what the wizard's summary lists. */
export function pendingSteps(ctx: OnboardingContext): OnboardingStep[] {
  return applicableSteps(ctx).filter(
    (step) => isTodo(step) && !step.isDone(ctx),
  );
}

/**
 * The step the wizard opens on. A requested step wins as long as it exists,
 * an already done step included, and anything else falls back to the
 * first step still to do, which a review never is: the wizard walks the user
 * into one, it does not drop them in it. With nothing left to do it opens on
 * the last step, which is the summary.
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
