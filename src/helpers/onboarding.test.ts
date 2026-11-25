import {
  ONBOARDING_STEPS,
  applicableSteps,
  experienceOf,
  firstStep,
  pendingSteps,
  stepLeadKey,
  stepTitleKey,
  type OnboardingContext,
  type OnboardingProvider,
} from "@/helpers/onboarding";
import { ProviderType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";

const BASE_ORDER = [
  "intent",
  "music_sources",
  "players",
  "core_settings",
  "ai",
  "invite_members",
  "finish",
] as const;

const MEMBER_ORDER = [
  "welcome",
  "your_players",
  "your_music",
  "all_set",
] as const;

function provider(
  type: ProviderType,
  domain: string,
  builtin = false,
  enabled = true,
): OnboardingProvider {
  return {
    type,
    domain,
    builtin,
    enabled,
    audioSource: false,
    aiService: false,
  };
}

/** A plugin that brings AI or speech. */
function aiService(
  domain: string,
  builtin = false,
  enabled = true,
): OnboardingProvider {
  return {
    ...provider(ProviderType.PLUGIN, domain, builtin, enabled),
    aiService: true,
  };
}

/** A plugin that lets an app play to Music Assistant. */
function audioSourcePlugin(
  domain: string,
  builtin = false,
  enabled = true,
): OnboardingProvider {
  return {
    ...provider(ProviderType.PLUGIN, domain, builtin, enabled),
    audioSource: true,
  };
}

function context(
  overrides: Partial<OnboardingContext> = {},
): OnboardingContext {
  return {
    isAdmin: true,
    isMember: false,
    firstRun: false,
    signedIn: true,
    welcomed: false,
    canOwnSources: false,
    ownedMusicSourceCount: 0,
    providers: [],
    playerCount: 0,
    // the add-on connects Home Assistant by itself, so only the tests of the
    // Home Assistant step run on a server that is not the add-on
    homeAssistantAddon: true,
    homeAssistantConfigured: false,
    homeAssistantConnected: false,
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
  it("uses a contextual app-connection title without changing other steps", () => {
    expect(stepTitleKey("plugins", { intent: "phone_apps" })).toBe(
      "onboarding.steps.plugins.phone_apps_title",
    );
    expect(stepTitleKey("plugins", { intent: "music_hub" })).toBe(
      "onboarding.steps.plugins.title",
    );
    expect(stepTitleKey("music_sources", { intent: "phone_apps" })).toBe(
      "onboarding.steps.music_sources.title",
    );
  });

  it("titles the remote access and AI steps by what they offer", () => {
    expect(stepTitleKey("core_settings")).toBe(
      "onboarding.steps.core_settings.away_title",
    );
    expect(stepTitleKey("ai")).toBe("onboarding.steps.ai.enrich_title");
  });

  it("titles the intent step with the question it asks", () => {
    expect(stepTitleKey("intent")).toBe("onboarding.steps.intent.title");
  });

  it("runs the admin track in its base order without an answer", () => {
    expect(stepIds(applicableSteps(context()))).toEqual([...BASE_ORDER]);
  });

  it("starts a first run with its welcome and the account, before anyone can sign in", () => {
    // no account yet, so no permissions either: the track is the first run's
    const ctx = context({ isAdmin: false, firstRun: true, signedIn: false });

    expect(stepIds(applicableSteps(ctx))).toEqual([
      "get_started",
      "account",
      ...BASE_ORDER,
    ]);
    expect(firstStep(ctx)).toBe("get_started");
    expect(step(ctx, "get_started").isDone(ctx)).toBe(false);
    expect(step(ctx, "account").isDone(ctx)).toBe(false);
    // nothing is a member either: the two tracks never mix
    expect(stepIds(pendingSteps(ctx)).slice(0, 2)).toEqual([
      "get_started",
      "account",
    ]);
  });

  it("ticks the account off once the first run is signed in, and moves on", () => {
    const ctx = context({ firstRun: true, signedIn: true });

    expect(step(ctx, "account").isDone(ctx)).toBe(true);
    // the welcome is behind the first run once its account is made
    expect(stepIds(applicableSteps(ctx))).toEqual(["account", ...BASE_ORDER]);
    expect(firstStep(ctx)).toBe("intent");
  });

  it("keeps the account ahead of existing-app setup on a fresh server", () => {
    const ctx = context({
      firstRun: true,
      signedIn: false,
      answers: { intent: "phone_apps" },
    });

    expect(stepIds(applicableSteps(ctx))).toEqual([
      "get_started",
      "account",
      "intent",
      "players",
      "plugins",
      "finish",
    ]);
  });

  it("never welcomes a setup run again, nor asks it for an account", () => {
    const ctx = context({ signedIn: true });

    expect(stepIds(applicableSteps(ctx))).not.toContain("get_started");
    expect(stepIds(applicableSteps(ctx))).not.toContain("account");
    expect(firstStep(ctx)).toBe("intent");
  });

  it("keeps the base order for someone building a music hub", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(stepIds(applicableSteps(ctx))).toEqual([...BASE_ORDER]);
    expect(step(ctx, "music_sources").optional).toBeFalsy();
  });

  it("only asks for speakers and app connections when using existing apps", () => {
    const ctx = context({ answers: { intent: "phone_apps" } });

    expect(stepIds(applicableSteps(ctx))).toEqual([
      "intent",
      "players",
      "plugins",
      "finish",
    ]);
  });

  it("keeps full setup available after choosing the existing-app path", () => {
    applicableSteps(context({ answers: { intent: "phone_apps" } }));

    expect(
      stepIds(applicableSteps(context({ answers: { intent: "music_hub" } }))),
    ).toEqual([...BASE_ORDER]);
    // the registry carries the welcome and the account step ahead of the admin
    // track, which only a first run is offered, the app connections only the
    // existing-app path is, Home Assistant only a server that is not the add-on
    // is, and the own-sources step between the music and the summary, whether
    // or not a given member is offered it
    expect(stepIds([...ONBOARDING_STEPS])).toEqual([
      "get_started",
      "account",
      "intent",
      "music_sources",
      "players",
      "plugins",
      "home_assistant",
      "core_settings",
      "ai",
      "invite_members",
      "finish",
      "welcome",
      "your_players",
      "your_music",
      "own_sources",
      "all_set",
    ]);
  });

  it("asks for app connections only when listening from other apps", () => {
    for (const intent of [undefined, "music_hub"] as const) {
      const ctx = context({ answers: intent ? { intent } : {} });
      expect(stepIds(applicableSteps(ctx))).not.toContain("plugins");
    }
    const apps = context({ answers: { intent: "phone_apps" } });
    expect(step(apps, "plugins").optional).toBeFalsy();
  });

  it("offers nothing to someone on neither track", () => {
    expect(applicableSteps(context({ isAdmin: false }))).toEqual([]);
  });
});

describe("onboarding step completion", () => {
  /** The existing-app setup with these providers set up. */
  function appContext(...providers: OnboardingProvider[]): OnboardingContext {
    return context({ answers: { intent: "phone_apps" }, providers });
  }

  it("only counts a plugin that lets an app play as connecting music apps", () => {
    const party = appContext(provider(ProviderType.PLUGIN, "party"));
    expect(step(party, "plugins").isDone(party)).toBe(false);

    const connected = appContext(audioSourcePlugin("vban_receiver"));
    expect(step(connected, "plugins").isDone(connected)).toBe(true);
  });

  it("counts a connected app as set up even while it is switched off", () => {
    const ctx = appContext(audioSourcePlugin("spotify_connect", false, false));
    expect(step(ctx, "plugins").isDone(ctx)).toBe(true);
  });

  it("does not count a builtin plugin as connecting music apps", () => {
    const ctx = appContext(audioSourcePlugin("sendspin_source", true));
    expect(step(ctx, "plugins").isDone(ctx)).toBe(false);
  });

  it("marks the intent done once it is answered", () => {
    expect(step(context(), "intent").isDone(context())).toBe(false);

    const answered = context({ answers: { intent: "music_hub" } });
    expect(step(answered, "intent").isDone(answered)).toBe(true);
  });

  it.each([
    ["music_sources", ProviderType.MUSIC],
    ["players", ProviderType.PLAYER],
  ])("marks %s done once one is configured", (id, type) => {
    const ctx = context({ providers: [provider(type, "some_domain")] });
    expect(step(ctx, id).isDone(ctx)).toBe(true);
  });

  it.each([
    ["music_sources", ProviderType.MUSIC],
    ["players", ProviderType.PLAYER],
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
  });

  it("never marks the review of the server settings done", () => {
    // nothing is missing from settings the server ships working values for, so
    // the wizard walks the user past it instead of skipping over it
    for (const intent of [undefined, "music_hub"] as const) {
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

  it("keeps the household invitation optional in full setup", () => {
    for (const intent of [undefined, "music_hub"] as const) {
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
      "ai",
      "invite_members",
    ]);
  });

  it("drops the steps that are done", () => {
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [provider(ProviderType.PLAYER, "sonos")],
      memberCount: 2,
    });
    expect(stepIds(pendingSteps(ctx))).toEqual(["music_sources", "ai"]);
  });

  it("is empty once every step is done", () => {
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [
        provider(ProviderType.MUSIC, "spotify"),
        provider(ProviderType.PLAYER, "sonos"),
        aiService("openai_compatible"),
      ],
      memberCount: 2,
    });
    expect(pendingSteps(ctx)).toEqual([]);
  });

  it("finishes existing-app setup without music sources or other user accounts", () => {
    const ctx = context({
      answers: { intent: "phone_apps" },
      providers: [
        provider(ProviderType.PLAYER, "sonos"),
        audioSourcePlugin("spotify_connect"),
      ],
      memberCount: 1,
    });

    expect(pendingSteps(ctx)).toEqual([]);
    expect(firstStep(ctx)).toBe("finish");
  });

  it("is empty for someone on neither track", () => {
    expect(pendingSteps(context({ isAdmin: false }))).toEqual([]);
  });
});

describe("the step the wizard opens on", () => {
  it("opens on the first step still to do", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(firstStep(ctx)).toBe("music_sources");
  });

  it("honours a deep link to a step that applies", () => {
    const ctx = context({ answers: { intent: "phone_apps" } });
    expect(firstStep(ctx, "plugins")).toBe("plugins");
  });

  it("opens the full setup on its first step to do instead of the app connections", () => {
    const ctx = context({ answers: { intent: "music_hub" } });
    expect(firstStep(ctx, "plugins")).toBe("music_sources");
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

  it.each(["music_sources", "core_settings", "invite_members"])(
    "resumes existing-app setup on a relevant step instead of %s",
    (requested) => {
      const ctx = context({ answers: { intent: "phone_apps" } });
      expect(firstStep(ctx, requested)).toBe("players");
    },
  );

  it("never opens on the server settings by itself", () => {
    // a review is nothing to do, so it is never what is left to do
    const ctx = context({
      answers: { intent: "music_hub" },
      providers: [
        provider(ProviderType.MUSIC, "spotify"),
        provider(ProviderType.PLAYER, "sonos"),
        aiService("openai_compatible"),
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
        audioSourcePlugin("spotify_connect"),
      ],
      memberCount: 2,
    });
    expect(firstStep(ctx)).toBe("finish");
  });
});

describe("the Home Assistant step", () => {
  /** A server that is not the Home Assistant add-on. */
  function standaloneContext(
    overrides: Partial<OnboardingContext> = {},
  ): OnboardingContext {
    return context({ homeAssistantAddon: false, ...overrides });
  }

  it("offers the full setup to connect Home Assistant before remote access", () => {
    // remote access goes through Home Assistant Link once Home Assistant is
    // connected, so the remote access step can say so
    const ctx = standaloneContext({ answers: { intent: "music_hub" } });
    expect(stepIds(applicableSteps(ctx))).toEqual([
      "intent",
      "music_sources",
      "players",
      "home_assistant",
      "core_settings",
      "ai",
      "invite_members",
      "finish",
    ]);
  });

  it("offers the existing-app setup to connect Home Assistant before the finish", () => {
    const ctx = standaloneContext({ answers: { intent: "phone_apps" } });
    expect(stepIds(applicableSteps(ctx))).toEqual([
      "intent",
      "players",
      "plugins",
      "home_assistant",
      "finish",
    ]);
  });

  it("never asks the add-on, which connects Home Assistant by itself", () => {
    for (const intent of [undefined, "music_hub", "phone_apps"] as const) {
      const ctx = context({ answers: intent ? { intent } : {} });
      expect(stepIds(applicableSteps(ctx))).not.toContain("home_assistant");
    }
  });

  it("keeps it optional, and pending until Home Assistant is connected", () => {
    const open = standaloneContext();
    expect(step(open, "home_assistant").optional).toBe(true);
    expect(stepIds(pendingSteps(open))).toContain("home_assistant");

    const connected = standaloneContext({ homeAssistantConfigured: true });
    expect(step(connected, "home_assistant").isDone(connected)).toBe(true);
    expect(stepIds(pendingSteps(connected))).not.toContain("home_assistant");
  });

  it("keeps it off the member track", () => {
    expect(
      stepIds(applicableSteps(memberContext({ homeAssistantAddon: false }))),
    ).not.toContain("home_assistant");
  });
});

describe("the AI step", () => {
  it("offers the full setup to add AI after remote access and before the users", () => {
    const steps = stepIds(applicableSteps(context()));

    expect(steps.indexOf("ai")).toBe(steps.indexOf("core_settings") + 1);
    expect(steps.indexOf("ai")).toBe(steps.indexOf("invite_members") - 1);
  });

  it("keeps it out of the existing-app setup and off the member track", () => {
    expect(
      stepIds(applicableSteps(context({ answers: { intent: "phone_apps" } }))),
    ).not.toContain("ai");
    expect(stepIds(applicableSteps(memberContext()))).not.toContain("ai");
  });

  it("keeps it optional, and pending until an AI service is set up", () => {
    const open = context({
      providers: [provider(ProviderType.PLUGIN, "lastfm_scrobble")],
    });
    expect(step(open, "ai").optional).toBe(true);
    expect(step(open, "ai").isDone(open)).toBe(false);

    const added = context({ providers: [aiService("openai_compatible")] });
    expect(step(added, "ai").isDone(added)).toBe(true);
    expect(stepIds(pendingSteps(added))).not.toContain("ai");
  });

  it("counts an AI service as set up even while it is switched off", () => {
    const ctx = context({
      providers: [aiService("openai_compatible", false, false)],
    });
    expect(step(ctx, "ai").isDone(ctx)).toBe(true);
  });

  it("does not count a builtin AI service", () => {
    const ctx = context({ providers: [aiService("builtin_ai", true)] });
    expect(step(ctx, "ai").isDone(ctx)).toBe(false);
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
    // a fresh server's welcome is not the member's
    expect(stepIds(applicableSteps(memberContext()))).not.toContain(
      "get_started",
    );
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

  it("asks for the experience, and for nothing else", () => {
    const ctx = memberContext();

    expect(step(ctx, "welcome").kind).toBe("step");
    expect(stepIds(pendingSteps(ctx))).toEqual(["welcome"]);
    // the rest is there to be looked at: a review is never something to do,
    // and neither is the summary that rounds the welcome off
    for (const id of ["your_players", "your_music"]) {
      expect(step(ctx, id).kind).toBe("review");
      expect(step(ctx, id).isDone(ctx)).toBe(false);
    }
    expect(step(ctx, "all_set").kind).toBe("summary");
    expect(step(ctx, "all_set").isDone(ctx)).toBe(false);
  });

  it("is done with the member once they have answered", () => {
    const ctx = memberContext({ answers: { expert: true } });

    expect(step(ctx, "welcome").isDone(ctx)).toBe(true);
    expect(pendingSteps(ctx)).toEqual([]);
  });

  it("is done with a member who has been welcomed before", () => {
    // having been shown the welcome is enough: nobody is asked again to answer
    // a question they were put in front of and walked away from
    const ctx = memberContext({ welcomed: true });

    expect(step(ctx, "welcome").isDone(ctx)).toBe(true);
    expect(pendingSteps(ctx)).toEqual([]);
  });

  it("still asks the member being welcomed right now", () => {
    // the marker is written on the way out, so during the run itself the
    // question is still open — and the summary still lists it
    const ctx = memberContext();

    expect(step(ctx, "welcome").isDone(ctx)).toBe(false);
    expect(stepIds(pendingSteps(ctx))).toEqual(["welcome"]);
  });

  it("drops the welcome from what is pending once it is answered", () => {
    const pending = memberContext();
    expect(stepIds(pendingSteps(pending))).toEqual(["welcome"]);

    // the standard experience is an answer too, not the question left open
    const answered = memberContext({ answers: { expert: false } });
    expect(pendingSteps(answered)).toEqual([]);
  });

  it("opens on the welcome, and on the summary once it is answered", () => {
    expect(firstStep(memberContext())).toBe("welcome");
    expect(firstStep(memberContext({ answers: { expert: false } }))).toBe(
      "all_set",
    );
    expect(firstStep(memberContext({ welcomed: true }))).toBe("all_set");
  });

  it("never falls back onto the other track's summary", () => {
    // the member is done: the end of their track is where the wizard lands,
    // not the summary of a setup they were never running
    const ctx = memberContext({ answers: { expert: true } });
    expect(firstStep(ctx, "core_settings")).toBe("all_set");
  });

  it("follows a deep link to a step of its own", () => {
    expect(firstStep(memberContext(), "your_music")).toBe("your_music");
  });
});

describe("the own-sources invitation", () => {
  /** A member whose role may add music sources of their own. */
  function ownMemberContext(
    overrides: Partial<OnboardingContext> = {},
  ): OnboardingContext {
    return memberContext({ canOwnSources: true, ...overrides });
  }

  const ownSources = ONBOARDING_STEPS.find(
    (candidate) => candidate.id === "own_sources",
  )!;

  it("offers the step to a member whose role may add its own sources", () => {
    expect(ownSources.appliesTo(ownMemberContext())).toBe(true);
  });

  it("keeps it from a member whose role may not", () => {
    expect(ownSources.appliesTo(memberContext())).toBe(false);
  });

  it("keeps it off the admin track", () => {
    // canOwnSources says nothing on the admin track: the step is a member's
    expect(ownSources.appliesTo(context({ canOwnSources: true }))).toBe(false);
  });

  it("is done once the member owns a music source", () => {
    expect(
      ownSources.isDone(ownMemberContext({ ownedMusicSourceCount: 0 })),
    ).toBe(false);
    expect(
      ownSources.isDone(ownMemberContext({ ownedMusicSourceCount: 1 })),
    ).toBe(true);
  });

  it("runs after the music that is here and before the summary", () => {
    expect(stepIds(applicableSteps(ownMemberContext()))).toEqual([
      "welcome",
      "your_players",
      "your_music",
      "own_sources",
      "all_set",
    ]);
  });

  it("keeps the optional invitation pending until a source is connected", () => {
    const open = ownMemberContext();
    expect(step(open, "own_sources").optional).toBe(true);
    expect(stepIds(pendingSteps(open))).toContain("own_sources");

    // no longer pending once a source of their own is connected
    const done = ownMemberContext({ ownedMusicSourceCount: 1 });
    expect(stepIds(pendingSteps(done))).not.toContain("own_sources");
  });
});

describe("the welcome's answer", () => {
  it("names the experience the expert mode flag stands for", () => {
    expect(experienceOf(true)).toBe("expert");
    expect(experienceOf(false)).toBe("standard");
  });
});

describe("the sentence under a step's title", () => {
  it("defaults to the step's own intro", () => {
    expect(stepLeadKey("intent", context())).toBe(
      "onboarding.steps.intent.intro",
    );
    expect(stepLeadKey("home_assistant", context())).toBe(
      "onboarding.steps.home_assistant.intro",
    );
  });

  it("says what can be done to the players once there are any", () => {
    expect(stepLeadKey("players", context())).toBe(
      "onboarding.steps.players.description_empty",
    );
    expect(stepLeadKey("players", context({ playerCount: 2 }))).toBe(
      "onboarding.steps.players.description",
    );
  });

  it("tells the add-on where Music Assistant is reached", () => {
    expect(
      stepLeadKey("core_settings", context({ homeAssistantAddon: false })),
    ).toBe("onboarding.steps.core_settings.intro");
    expect(stepLeadKey("core_settings", context())).toBe(
      "onboarding.steps.core_settings.intro_addon",
    );
  });

  it("introduces the AI examples only while no AI service is set up", () => {
    expect(stepLeadKey("ai", context())).toBe(
      "onboarding.steps.ai.intro_examples",
    );
    // a builtin service says nothing about what was set up
    expect(
      stepLeadKey("ai", context({ providers: [aiService("tts", true)] })),
    ).toBe("onboarding.steps.ai.intro_examples");
    expect(
      stepLeadKey("ai", context({ providers: [aiService("openai")] })),
    ).toBe("onboarding.steps.ai.intro");
  });

  it("recaps the app setup in its own words", () => {
    expect(stepLeadKey("finish", context())).toBe(
      "onboarding.steps.finish.description",
    );
    expect(
      stepLeadKey("finish", context({ answers: { intent: "phone_apps" } })),
    ).toBe("onboarding.steps.finish.phone_apps_description");
  });
});
