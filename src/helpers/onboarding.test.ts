import {
  ONBOARDING_STEPS,
  applicableSteps,
  firstStep,
  orderSteps,
  pendingSteps,
  requiredPendingSteps,
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
  "finish",
] as const;

function provider(
  type: ProviderType,
  domain: string,
  builtin = false,
): OnboardingProvider {
  return { type, domain, builtin };
}

function context(
  overrides: Partial<OnboardingContext> = {},
): OnboardingContext {
  return {
    isAdmin: true,
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
  if (!found) throw new Error(`step ${id} does not apply`);
  return found;
}

describe("onboarding step order", () => {
  it("runs the admin track in its base order without an answer", () => {
    expect(stepIds(applicableSteps(context()))).toEqual([...BASE_ORDER]);
  });

  it("keeps the base order for someone building a music hub", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(stepIds(applicableSteps(ctx))).toEqual([...BASE_ORDER]);
    expect(step(ctx, "music_sources").optional).toBeFalsy();
  });

  it("defers the music sources for someone streaming from phone apps", () => {
    const ctx = context({ answers: { intent: "phone_apps" } });

    expect(stepIds(applicableSteps(ctx))).toEqual([
      "intent",
      "players",
      "plugins",
      "music_sources",
      "finish",
    ]);
    // deferred, not dropped: it is still offered, just no longer blocking
    expect(step(ctx, "music_sources").optional).toBe(true);
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
    expect(stepIds([...ONBOARDING_STEPS])).toEqual([...BASE_ORDER]);
  });

  it("keeps the plugins optional in every order", () => {
    for (const intent of [undefined, "music_hub", "phone_apps"] as const) {
      const ctx = context({ answers: intent ? { intent } : {} });
      expect(step(ctx, "plugins").optional).toBe(true);
    }
  });

  it("offers nothing to someone who is not an admin", () => {
    expect(applicableSteps(context({ isAdmin: false }))).toEqual([]);
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
  it("lists everything still to do, summary excluded", () => {
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

  it("is empty for someone who is not an admin", () => {
    expect(pendingSteps(context({ isAdmin: false }))).toEqual([]);
  });
});

describe("the pending onboarding steps that block finishing", () => {
  it("leaves out the optional steps the checklist must not nag about", () => {
    expect(stepIds(requiredPendingSteps(context()))).toEqual([
      "intent",
      "music_sources",
      "players",
    ]);
  });

  it("is empty once only optional steps are left", () => {
    const ctx = context({
      answers: { intent: "phone_apps" },
      providers: [provider(ProviderType.PLAYER, "sonos")],
    });

    // the music sources are deferred behind the plugins for this answer, so
    // both of the steps still to do are optional ones
    expect(stepIds(pendingSteps(ctx))).toEqual(["plugins", "music_sources"]);
    expect(requiredPendingSteps(ctx)).toEqual([]);
  });
});

describe("the step the wizard opens on", () => {
  it("opens on the first step still to do", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(firstStep(ctx)).toBe("music_sources");
  });

  it("honours a deep link to a step that applies", () => {
    expect(firstStep(context(), "plugins")).toBe("plugins");
  });

  it("honours a deep link to a step that is already done", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(firstStep(ctx, "intent")).toBe("intent");
  });

  it.each(["", "nope", "core_settings"])(
    "falls back to the first pending step for the unknown id %o",
    (requested) => {
      expect(firstStep(context(), requested)).toBe("intent");
    },
  );

  it("falls back for a step that does not apply", () => {
    expect(firstStep(context({ isAdmin: false }), "players")).toBe("finish");
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
