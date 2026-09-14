import {
  ONBOARDING_STEPS,
  PERSONA_DEFAULTS,
  applicableSteps,
  checklistPendingSteps,
  checklistSteps,
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
  "invite_members",
  "finish",
] as const;

const MEMBER_ORDER = ["welcome", "whats_here", "tour", "all_set"] as const;

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
    isAdmin: true,
    isMember: false,
    welcomed: false,
    providers: [],
    playerCount: 0,
    memberCount: null,
    answers: {},
    ...overrides,
  };
}

/** A household member: someone who lives here without running the place. */
function memberContext(
  overrides: Partial<OnboardingContext> = {},
): OnboardingContext {
  return context({ isAdmin: false, isMember: true, ...overrides });
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

    // behind the plugins and ahead of the review, which is no place to leave
    // something that is still to do
    expect(stepIds(applicableSteps(ctx))).toEqual([
      "intent",
      "players",
      "plugins",
      "music_sources",
      "core_settings",
      "invite_members",
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
    expect(stepIds([...ONBOARDING_STEPS])).toEqual([
      ...BASE_ORDER,
      ...MEMBER_ORDER,
    ]);
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
      "invite_members",
      "finish",
    ]);
  });

  it("keeps the plugins optional in every order", () => {
    for (const intent of [undefined, "music_hub", "phone_apps"] as const) {
      const ctx = context({ answers: intent ? { intent } : {} });
      expect(step(ctx, "plugins").optional).toBe(true);
    }
  });

  it("offers nothing to someone on neither track", () => {
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

  it.each([
    [null, false],
    [0, false],
    [1, false],
    [2, true],
  ])("marks the household of %o members done: %o", (memberCount, done) => {
    // one member is the admin running the wizard; not knowing who is in the
    // household is not the same as nobody else being in it
    const ctx = context({ memberCount });
    expect(step(ctx, "invite_members").isDone(ctx)).toBe(done);
  });

  it("keeps the household optional, whatever the answer", () => {
    for (const intent of [undefined, "music_hub", "phone_apps"] as const) {
      const ctx = context({ answers: intent ? { intent } : {} });
      expect(step(ctx, "invite_members").optional).toBe(true);
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
      "invite_members",
    ]);
  });

  it("drops the steps that are done", () => {
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [provider(ProviderType.PLAYER, "sonos")],
      memberCount: 2,
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
      memberCount: 2,
    });
    expect(pendingSteps(ctx)).toEqual([]);
  });

  it("is empty for someone on neither track", () => {
    expect(pendingSteps(context({ isAdmin: false }))).toEqual([]);
  });
});

describe("the getting started checklist", () => {
  it("lists the core steps, done or not, and counts the ones still to do", () => {
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [provider(ProviderType.PLAYER, "sonos")],
    });

    // what is listed and what is counted are the same steps, so the badge can
    // never say something the list does not show
    expect(stepIds(checklistSteps(ctx))).toEqual([
      "intent",
      "music_sources",
      "players",
    ]);
    expect(stepIds(checklistPendingSteps(ctx))).toEqual(["music_sources"]);
  });

  it.each([undefined, "music_hub", "phone_apps"] as const)(
    "never asks for what it is not there to ask for, whatever the answer (%s)",
    (intent) => {
      const ctx = context({ answers: intent ? { intent } : {} });
      const listed = stepIds(checklistSteps(ctx));
      // the plugins and the household are optional by nature, the server
      // settings are only there to be looked over
      expect(listed).not.toContain("plugins");
      expect(listed).not.toContain("invite_members");
      expect(listed).not.toContain("core_settings");
    },
  );

  it("keeps asking for a music source that was only deferred", () => {
    const ctx = context({
      answers: { intent: "phone_apps" },
      providers: [provider(ProviderType.PLAYER, "sonos")],
    });

    // the music sources moved behind the plugins for this answer; the plugins
    // and the household are what the checklist stays quiet about
    expect(stepIds(pendingSteps(ctx))).toEqual([
      "plugins",
      "music_sources",
      "invite_members",
    ]);
    expect(stepIds(checklistSteps(ctx))).toEqual([
      "intent",
      "players",
      "music_sources",
    ]);
    expect(stepIds(checklistPendingSteps(ctx))).toEqual(["music_sources"]);
  });

  it("is empty once every step it lists is done", () => {
    const ctx = context({
      answers: { intent: "phone_apps" },
      providers: [
        provider(ProviderType.MUSIC, "spotify"),
        provider(ProviderType.PLAYER, "sonos"),
      ],
    });

    // the plugins and the household are still to do, and still nothing the
    // checklist asks for
    expect(stepIds(pendingSteps(ctx))).toEqual(["plugins", "invite_members"]);
    expect(checklistPendingSteps(ctx)).toEqual([]);
  });

  it("lists nothing for someone on neither track", () => {
    expect(checklistSteps(context({ isAdmin: false }))).toEqual([]);
    expect(checklistPendingSteps(context({ isAdmin: false }))).toEqual([]);
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
    expect(firstStep(ctx)).toBe("invite_members");
    expect(firstStep({ ...ctx, memberCount: 2 })).toBe("finish");
  });

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
      memberCount: 2,
    });
    expect(firstStep(ctx)).toBe("finish");
  });
});

describe("the member track", () => {
  it("welcomes a household member in its own order", () => {
    // nothing of the setup: a member sets nothing up, so none of the admin
    // track's steps are ever put in front of them
    expect(stepIds(applicableSteps(memberContext()))).toEqual([
      ...MEMBER_ORDER,
    ]);
  });

  it("keeps the two tracks apart", () => {
    const admin = stepIds(applicableSteps(context()));
    for (const id of MEMBER_ORDER) expect(admin).not.toContain(id);
  });

  it.each([undefined, "music_hub", "phone_apps"] as const)(
    "runs in the same order whatever the setup answer says (%s)",
    (intent) => {
      // the intent question is the admin track's; an answer left on the
      // account has nothing to reorder here
      const ctx = memberContext({ answers: intent ? { intent } : {} });
      expect(stepIds(applicableSteps(ctx))).toEqual([...MEMBER_ORDER]);
    },
  );

  it("asks for the persona, and for nothing else", () => {
    const ctx = memberContext();

    expect(step(ctx, "welcome").kind).toBe("step");
    expect(stepIds(pendingSteps(ctx))).toEqual(["welcome"]);
    // the rest is there to be looked at: a review is never something to do,
    // and neither is the summary that rounds the welcome off
    for (const id of ["whats_here", "tour"]) {
      expect(step(ctx, id).kind).toBe("review");
      expect(step(ctx, id).isDone(ctx)).toBe(false);
    }
    expect(step(ctx, "all_set").kind).toBe("summary");
    expect(step(ctx, "all_set").isDone(ctx)).toBe(false);
  });

  it("is done with the member once they have answered", () => {
    const ctx = memberContext({ answers: { persona: "enthusiast" } });

    expect(step(ctx, "welcome").isDone(ctx)).toBe(true);
    expect(pendingSteps(ctx)).toEqual([]);
  });

  it("is done with a member who has been welcomed before", () => {
    // having been shown the welcome is enough: nobody is asked again to answer
    // a question they were put in front of and walked away from
    const ctx = memberContext({ welcomed: true });

    expect(step(ctx, "welcome").isDone(ctx)).toBe(true);
    expect(pendingSteps(ctx)).toEqual([]);
    expect(checklistPendingSteps(ctx)).toEqual([]);
  });

  it("still asks the member being welcomed right now", () => {
    // the marker is written on the way out, so during the run itself the
    // question is still open — and the summary still lists it
    const ctx = memberContext();

    expect(step(ctx, "welcome").isDone(ctx)).toBe(false);
    expect(stepIds(pendingSteps(ctx))).toEqual(["welcome"]);
  });

  it("asks on the checklist for the one thing it asks for", () => {
    const pending = memberContext();
    expect(stepIds(checklistSteps(pending))).toEqual(["welcome"]);
    expect(stepIds(checklistPendingSteps(pending))).toEqual(["welcome"]);

    const answered = memberContext({ answers: { persona: "regular" } });
    expect(stepIds(checklistSteps(answered))).toEqual(["welcome"]);
    expect(checklistPendingSteps(answered)).toEqual([]);
  });

  it("opens on the welcome, and on the summary once it is answered", () => {
    expect(firstStep(memberContext())).toBe("welcome");
    expect(firstStep(memberContext({ answers: { persona: "regular" } }))).toBe(
      "all_set",
    );
    expect(firstStep(memberContext({ welcomed: true }))).toBe("all_set");
  });

  it("never falls back onto the other track's summary", () => {
    // the member is done: the end of their track is where the wizard lands,
    // not the summary of a setup they were never running
    const ctx = memberContext({ answers: { persona: "enthusiast" } });
    expect(firstStep(ctx, "core_settings")).toBe("all_set");
  });

  it("follows a deep link to a step of its own", () => {
    expect(firstStep(memberContext(), "tour")).toBe("tour");
  });
});

describe("the persona defaults", () => {
  it.each(["enthusiast", "regular"] as const)(
    "seeds what the %s asked for",
    (persona) => {
      // both answers write the same settings, so choosing again always lands
      // on a complete set rather than on half of the last one
      expect(Object.keys(PERSONA_DEFAULTS[persona]).sort()).toEqual([
        "show_waveform",
        "visualizer_enabled",
      ]);
    },
  );

  it("shows the player off to whoever asked for the details", () => {
    expect(PERSONA_DEFAULTS.enthusiast).toEqual({
      show_waveform: true,
      visualizer_enabled: true,
    });
    expect(PERSONA_DEFAULTS.regular).toEqual({
      show_waveform: false,
      visualizer_enabled: false,
    });
  });
});
