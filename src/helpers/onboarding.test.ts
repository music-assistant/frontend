import {
  ONBOARDING_STEPS,
  applicableSteps,
  firstStep,
  orderSteps,
  pendingSteps,
  type OnboardingContext,
  type OnboardingProvider,
} from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";

const BASE_ORDER = [
  "intent",
  "music_sources",
  "players",
  "plugins",
  "core_settings",
  "finish",
] as const;

function provider(
  type: ProviderType,
  domain: string,
  builtin = false,
  enabled = true,
): OnboardingProvider {
  return { type, domain, builtin, enabled };
}

function context(
  overrides: Partial<OnboardingContext> = {},
): OnboardingContext {
  return {
    providers: [],
    playerCount: 0,
    answers: {},
    ...overrides,
  };
}

function stepIds(steps: { id: string }[]): string[] {
  return steps.map((step) => step.id);
}

function step(ctx: OnboardingContext, id: string) {
  const found = applicableSteps(ctx).find((candidate) => candidate.id === id);
  if (!found) throw new Error(`step ${id} does not exist`);
  return found;
}

describe("onboarding step order", () => {
  it("runs the setup in its base order without an answer", () => {
    expect(stepIds(applicableSteps(context()))).toEqual([...BASE_ORDER]);
  });

  it("opens on the intent question on a fresh setup", () => {
    expect(firstStep(context())).toBe("intent");
  });

  it("keeps the base order for someone building a music hub", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(stepIds(applicableSteps(ctx))).toEqual([...BASE_ORDER]);
    expect(step(ctx, "music_sources").optional).toBeFalsy();
  });

  it("defers the music sources for someone streaming from phone apps", () => {
    const ctx = context({ answers: { intent: "phone_apps" } });

    // behind the plugins and ahead of the review, which is no place to leave
    // something that is still to do
    expect(stepIds(applicableSteps(ctx))).toEqual([
      "intent",
      "players",
      "plugins",
      "music_sources",
      "core_settings",
      "finish",
    ]);
    // deferred, not dropped: it is still offered and still asked for, it just
    // no longer holds the wizard up, which is not the same as being optional
    expect(step(ctx, "music_sources").deferred).toBe(true);
    expect(step(ctx, "music_sources").optional).toBeFalsy();
  });

  it("changes order and emphasis only, never which steps are available", () => {
    const deferred = applicableSteps(
      context({ answers: { intent: "phone_apps" } }),
    );
    expect(stepIds(deferred).sort()).toEqual([...BASE_ORDER].sort());
  });

  it("leaves the step registry untouched when it reorders", () => {
    orderSteps(ONBOARDING_STEPS, { intent: "phone_apps" });

    const registered = ONBOARDING_STEPS.find(
      (candidate) => candidate.id === "music_sources",
    );
    expect(registered?.optional).toBeUndefined();
    expect(registered?.deferred).toBeUndefined();
    expect(stepIds([...ONBOARDING_STEPS])).toEqual([...BASE_ORDER]);
  });

  it("still keeps a deferred step out of the tail without the plugins", () => {
    // nothing to sit behind: the deferred music sources land ahead of the
    // review, which is no place to leave something that is still to do
    const withoutPlugins = applicableSteps(context()).filter(
      (candidate) => candidate.id !== "plugins",
    );

    expect(
      stepIds(orderSteps(withoutPlugins, { intent: "phone_apps" })),
    ).toEqual([
      "intent",
      "players",
      "music_sources",
      "core_settings",
      "finish",
    ]);
  });

  it("keeps the plugins optional in every order", () => {
    for (const intent of [undefined, "music_hub", "phone_apps"] as const) {
      const ctx = context({ answers: intent ? { intent } : {} });
      expect(step(ctx, "plugins").optional).toBe(true);
    }
  });
});

describe("onboarding step completion", () => {
  it("marks the intent done once it is answered", () => {
    expect(step(context(), "intent").isDone(context())).toBe(false);

    const answered = context({ answers: { intent: "music_hub" } });
    expect(step(answered, "intent").isDone(answered)).toBe(true);
  });

  it.each([
    ["music_sources", ProviderType.MUSIC],
    ["players", ProviderType.PLAYER],
    ["plugins", ProviderType.PLUGIN],
  ])("marks %s done once one is configured", (id, type) => {
    const ctx = context({ providers: [provider(type, "some_domain")] });
    expect(step(ctx, id).isDone(ctx)).toBe(true);
  });

  it.each([
    ["music_sources", ProviderType.MUSIC],
    ["players", ProviderType.PLAYER],
    ["plugins", ProviderType.PLUGIN],
  ])("counts %s as set up even while it is switched off", (id, type) => {
    // a disabled provider is something the user set up and can switch back on,
    // so the wizard flags it rather than asking for it again
    const ctx = context({
      providers: [provider(type, "some_domain", false, false)],
    });
    expect(step(ctx, id).isDone(ctx)).toBe(true);
  });

  it.each([
    ["music_sources", ProviderType.MUSIC],
    ["players", ProviderType.PLAYER],
    ["plugins", ProviderType.PLUGIN],
  ])("does not count a builtin provider as %s being set up", (id, type) => {
    const ctx = context({
      providers: [provider(type, "builtin_domain", true)],
    });
    expect(step(ctx, id).isDone(ctx)).toBe(false);
  });

  it("does not let one provider type stand in for another", () => {
    const ctx = context({
      providers: [provider(ProviderType.MUSIC, "spotify")],
    });
    expect(step(ctx, "music_sources").isDone(ctx)).toBe(true);
    expect(step(ctx, "players").isDone(ctx)).toBe(false);
    expect(step(ctx, "plugins").isDone(ctx)).toBe(false);
  });

  it("never marks the review of the server settings done", () => {
    // nothing is missing from settings the server ships working values for, so
    // the wizard walks the user past it instead of skipping over it
    for (const intent of [undefined, "music_hub", "phone_apps"] as const) {
      const ctx = context({ answers: intent ? { intent } : {} });
      expect(step(ctx, "core_settings").kind).toBe("review");
      expect(step(ctx, "core_settings").isDone(ctx)).toBe(false);
    }
  });

  it("never marks the summary done", () => {
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [
        provider(ProviderType.MUSIC, "spotify"),
        provider(ProviderType.PLAYER, "sonos"),
        provider(ProviderType.PLUGIN, "party"),
      ],
    });
    expect(step(ctx, "finish").isDone(ctx)).toBe(false);
  });
});

describe("pending onboarding steps", () => {
  it("lists everything still to do, review and summary excluded", () => {
    expect(stepIds(pendingSteps(context()))).toEqual([
      "intent",
      "music_sources",
      "players",
      "plugins",
    ]);
  });

  it("drops the steps that are done", () => {
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [provider(ProviderType.PLAYER, "sonos")],
    });
    expect(stepIds(pendingSteps(ctx))).toEqual(["music_sources", "plugins"]);
  });

  it("is empty once every step is done", () => {
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [
        provider(ProviderType.MUSIC, "spotify"),
        provider(ProviderType.PLAYER, "sonos"),
        provider(ProviderType.PLUGIN, "party"),
      ],
    });
    expect(pendingSteps(ctx)).toEqual([]);
  });
});

describe("the step the wizard opens on", () => {
  it("opens on the first step still to do", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(firstStep(ctx)).toBe("music_sources");
  });

  it("honours a deep link to a step", () => {
    expect(firstStep(context(), "plugins")).toBe("plugins");
  });

  it("honours a deep link to a step that is already done", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(firstStep(ctx, "intent")).toBe("intent");
  });

  it.each(["", "nope", "household"])(
    "falls back to the first pending step for the unknown id %o",
    (requested) => {
      expect(firstStep(context(), requested)).toBe("intent");
    },
  );

  it("honours a deep link to a step that is only there to be looked over", () => {
    expect(firstStep(context(), "core_settings")).toBe("core_settings");
  });

  it("never opens on the server settings by itself", () => {
    // a review is nothing to do, so it is never what is left to do
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [
        provider(ProviderType.MUSIC, "spotify"),
        provider(ProviderType.PLAYER, "sonos"),
        provider(ProviderType.PLUGIN, "party"),
      ],
    });
    expect(firstStep(ctx)).toBe("finish");
  });

  it("opens on the summary once nothing is pending", () => {
    const ctx = context({
      answers: { intent: "phone_apps" },
      providers: [
        provider(ProviderType.MUSIC, "spotify"),
        provider(ProviderType.PLAYER, "sonos"),
        provider(ProviderType.PLUGIN, "party"),
      ],
    });
    expect(firstStep(ctx)).toBe("finish");
  });
});
