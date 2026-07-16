import {
  resolveGuestEntry,
  useGuestEntryResolver,
  type GuestEntryState,
} from "@/composables/useGuestEntryResolver";
import { markMusicQuizJoinedGameEnded } from "@/helpers/music_quiz_guest_state";
import { EventType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { defineComponent, h, type DeepReadonly, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  authManagerMock,
  guestIdentity,
  routeMock,
  routerReplace,
  storeMock,
} = vi.hoisted(() => {
  const routeMock = { path: "/guest" };
  const guestIdentity = { value: "guest-token-1" as string | undefined };
  return {
    apiMock: {
      baseUrl: "http://music-assistant:8095",
      isRemoteConnection: { value: false },
      providers: {} as Record<string, { domain: string }>,
      sendCommand: vi.fn(),
      state: { value: "initialized" },
      subscribe: vi.fn(),
    },
    authManagerMock: {
      getClaim: vi.fn(() => guestIdentity.value),
      isGuestAccessSession: vi.fn(() => true),
    },
    guestIdentity,
    routeMock,
    routerReplace: vi.fn(async (path: string) => {
      routeMock.path = path;
    }),
    storeMock: {
      currentUser: undefined as { user_id: string } | undefined,
    },
  };
});

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  ConnectionState: { INITIALIZED: "initialized" },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: authManagerMock,
}));

vi.mock("@/plugins/remote", () => ({
  remoteConnectionManager: {
    currentRemoteId: { value: null },
  },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ replace: routerReplace }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("guest entry decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.providers = {};
    apiMock.sendCommand.mockResolvedValue(null);
    apiMock.subscribe.mockImplementation(() => () => {});
    authManagerMock.getClaim.mockImplementation(() => guestIdentity.value);
    authManagerMock.isGuestAccessSession.mockReturnValue(true);
    guestIdentity.value = "guest-token-1";
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("sessionStorage", createStorage());
    storeMock.currentUser = undefined;
    routeMock.path = "/guest";
  });

  it("routes an active Music Quiz ahead of Party", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });

    await expect(resolveGuestEntry()).resolves.toBe("quiz");
    expect(apiMock.sendCommand).toHaveBeenCalledWith(
      "music_quiz/info",
      undefined,
      { suppressGlobalError: true },
    );
    expect(getStoredAffinity()).toEqual({
      version: 2,
      connectionIdentity: "local:http://music-assistant:8095",
      participantIdentity: "guest-token-1",
    });
  });

  it("propagates a music quiz info failure", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockRejectedValue(new Error("boom"));

    await expect(resolveGuestEntry()).rejects.toThrow("boom");
  });

  it("keeps an entered Music Quiz ahead of Party after it disappears", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValueOnce({ game_id: "active" });
    await expect(resolveGuestEntry()).resolves.toBe("quiz");

    apiMock.sendCommand.mockResolvedValue(null);
    await expect(resolveGuestEntry()).resolves.toBe("quiz-inactive");
  });

  it("keeps showing a finished Music Quiz while it still exists", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValue({
      game_id: "finished",
      phase: "finished",
    });

    await expect(resolveGuestEntry()).resolves.toBe("quiz");
  });

  it("routes to Party when Music Quiz is inactive", async () => {
    setProviders("party", "music_quiz");

    await expect(resolveGuestEntry()).resolves.toBe("party");
  });

  it("shows the Quiz inactive state when only Music Quiz is installed", async () => {
    setProviders("music_quiz");

    await expect(resolveGuestEntry()).resolves.toBe("quiz-inactive");
  });

  it("shows the generic inactive state without guest providers", async () => {
    await expect(resolveGuestEntry()).resolves.toBe("inactive");
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("routes directly to Party without invoking an absent Quiz provider", async () => {
    setProviders("party");

    await expect(resolveGuestEntry()).resolves.toBe("party");
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("does not restore Quiz affinity for a different guest identity", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValueOnce({ game_id: "active" });
    await expect(resolveGuestEntry()).resolves.toBe("quiz");

    guestIdentity.value = "guest-token-2";
    apiMock.sendCommand.mockResolvedValue(null);
    await expect(resolveGuestEntry()).resolves.toBe("party");
    expect(getStoredAffinity()).toBeNull();
  });

  it("ignores corrupt affinity without misrouting a Party guest", async () => {
    setProviders("party", "music_quiz");
    sessionStorage.setItem("music_quiz_guest_affinity", "{broken");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(resolveGuestEntry()).resolves.toBe("party");
    expect(getStoredAffinity()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "Ignoring corrupt Music Quiz participant affinity.",
      expect.any(SyntaxError),
    );
  });
});

describe("guest entry transitions", () => {
  let wrapper: ReturnType<typeof mount> | undefined;
  let resolverState: DeepReadonly<Ref<GuestEntryState>>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.providers = {};
    apiMock.state.value = "initialized";
    apiMock.sendCommand.mockResolvedValue(null);
    apiMock.subscribe.mockImplementation(() => () => {});
    authManagerMock.getClaim.mockImplementation(() => guestIdentity.value);
    authManagerMock.isGuestAccessSession.mockReturnValue(true);
    guestIdentity.value = "guest-token-1";
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("sessionStorage", createStorage());
    storeMock.currentUser = undefined;
    routeMock.path = "/guest";
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("shows an error state when the initial resolution fails", async () => {
    setProviders("party", "music_quiz");
    routeMock.path = "/guest/party";
    apiMock.sendCommand.mockRejectedValue(new Error("boom"));
    wrapper = mountResolver((state) => {
      resolverState = state;
    });

    await expectState("error");

    expect(routeMock.path).toBe("/guest");
    expect(routerReplace).toHaveBeenCalledOnce();
    expect(routerReplace).toHaveBeenCalledWith("/guest");
  });

  it("preserves the current Quiz state when a refresh fails", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    let resolveEntry!: () => Promise<void>;
    wrapper = mountResolver((state, resolve) => {
      resolverState = state;
      resolveEntry = resolve;
    });
    await expectState("quiz");

    apiMock.sendCommand.mockRejectedValue(new Error("boom"));
    await resolveEntry();

    expect(resolverState.value).toBe("quiz");
    expect(routeMock.path).toBe("/guest/quiz");
    expect(routerReplace).toHaveBeenCalledOnce();
  });

  it("recovers from an initial error on a later provider event", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockRejectedValue(new Error("boom"));
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("error");

    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    signalProviderEvent({ event: "game_updated", state: {} });

    await expectState("quiz");
    expect(routeMock.path).toBe("/guest/quiz");
  });

  it("keeps a Party guest in Quiz context and returns to the next game", async () => {
    setProviders("party", "music_quiz");
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("party");

    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    signalProviderEvent({ event: "game_updated", state: {} });
    await expectState("quiz");

    apiMock.sendCommand.mockResolvedValue(null);
    markMusicQuizJoinedGameEnded();
    signalProviderEvent({ event: "game_removed" });
    await expectState("quiz-inactive");
    expect(routeMock.path).toBe("/guest");

    apiMock.sendCommand.mockResolvedValue({ game_id: "next" });
    signalProviderEvent({ event: "game_updated", state: {} });
    await expectState("quiz");

    expect(routerReplace.mock.calls.map(([path]) => path)).toEqual([
      "/guest/party",
      "/guest/quiz",
      "/guest",
      "/guest/quiz",
    ]);
  });

  it("restores Quiz affinity when the resolver is recreated", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });

    await expectState("quiz");

    wrapper.unmount();
    wrapper = undefined;
    routeMock.path = "/guest";
    apiMock.sendCommand.mockResolvedValue(null);
    wrapper = mountResolver((state) => {
      resolverState = state;
    });

    await expectState("quiz-inactive");
    expect(routeMock.path).toBe("/guest");
  });

  it("restores Quiz affinity for a regular authenticated user", async () => {
    guestIdentity.value = undefined;
    storeMock.currentUser = { user_id: "regular-user" };
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    wrapper.unmount();
    wrapper = undefined;
    routeMock.path = "/guest";
    apiMock.sendCommand.mockResolvedValue(null);
    wrapper = mountResolver((state) => {
      resolverState = state;
    });

    await expectState("quiz-inactive");
    expect(getStoredAffinity()).toEqual({
      version: 2,
      connectionIdentity: "local:http://music-assistant:8095",
      participantIdentity: "regular-user",
    });
  });

  it("drops live affinity when the guest identity changes", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    guestIdentity.value = "guest-token-2";
    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_updated", state: {} });

    await expectState("party");
    expect(routeMock.path).toBe("/guest/party");
    expect(getStoredAffinity()).toBeNull();
  });

  it("does not let a stale resolution override a newer game event", async () => {
    setProviders("party", "music_quiz");
    let resolveFirstRequest!: (value: null) => void;
    apiMock.sendCommand
      .mockImplementationOnce(
        () =>
          new Promise<null>((resolve) => {
            resolveFirstRequest = resolve;
          }),
      )
      .mockResolvedValue({ game_id: "active" });

    wrapper = mountResolver((state) => {
      resolverState = state;
    });

    await vi.waitFor(() => expect(apiMock.sendCommand).toHaveBeenCalledOnce());

    signalProviderEvent({ event: "game_updated", state: {} });
    expect(apiMock.sendCommand).toHaveBeenCalledOnce();
    resolveFirstRequest(null);

    await expectState("quiz");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(routerReplace).toHaveBeenCalledTimes(1);
    expect(routerReplace).toHaveBeenCalledWith("/guest/quiz");
  });

  it("does not record affinity from a stale active Quiz result", async () => {
    setProviders("party", "music_quiz");
    let resolveFirstRequest!: (value: { game_id: string }) => void;
    apiMock.sendCommand
      .mockImplementationOnce(
        () =>
          new Promise<{ game_id: string }>((resolve) => {
            resolveFirstRequest = resolve;
          }),
      )
      .mockResolvedValue(null);

    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await vi.waitFor(() => expect(apiMock.sendCommand).toHaveBeenCalledOnce());

    signalProviderEvent({ event: "game_updated", state: {} });
    resolveFirstRequest({ game_id: "stale" });

    await expectState("party");
    expect(getStoredAffinity()).toBeNull();
    expect(routerReplace).toHaveBeenCalledOnce();
    expect(routerReplace).toHaveBeenCalledWith("/guest/party");
  });

  it("shows the no-active Quiz state when a joined game ends", async () => {
    setProviders("music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    markMusicQuizJoinedGameEnded();
    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_removed" });
    await expectState("quiz-inactive");

    expect(routeMock.path).toBe("/guest");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("does not route an ended Quiz guest to an available Party", async () => {
    setProviders("music_quiz", "party");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    markMusicQuizJoinedGameEnded();
    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_removed" });
    await expectState("quiz-inactive");

    expect(routeMock.path).toBe("/guest");
  });

  it("does not let an in-flight refresh overwrite the ended state", async () => {
    setProviders("music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    let resolveRefresh!: (value: null) => void;
    apiMock.sendCommand
      .mockImplementationOnce(
        () =>
          new Promise<null>((resolve) => {
            resolveRefresh = resolve;
          }),
      )
      .mockResolvedValue(null);
    signalProviderEvent({ event: "game_updated", state: {} });
    await vi.waitFor(() =>
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2),
    );

    markMusicQuizJoinedGameEnded();
    signalProviderEvent({ event: "game_removed" });
    resolveRefresh(null);
    await expectState("quiz-inactive");

    expect(routeMock.path).toBe("/guest");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
  });

  it("restores the no-active state while the guest route is loading", async () => {
    setProviders("music_quiz");
    routeMock.path = "/guest/quiz";
    storeAffinity("guest-token-1");
    let resolveInitialRequest!: (value: null) => void;
    apiMock.sendCommand
      .mockImplementationOnce(
        () =>
          new Promise<null>((resolve) => {
            resolveInitialRequest = resolve;
          }),
      )
      .mockResolvedValue(null);
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await vi.waitFor(() => expect(apiMock.sendCommand).toHaveBeenCalledOnce());
    expect(resolverState.value).toBe("loading");

    markMusicQuizJoinedGameEnded();
    signalProviderEvent({ event: "game_removed" });
    resolveInitialRequest(null);
    await expectState("quiz-inactive");

    expect(routeMock.path).toBe("/guest");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("keeps live affinity when persistent storage is unavailable", async () => {
    const storageError = new DOMException("Storage denied", "SecurityError");
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn(() => {
        throw storageError;
      }),
      removeItem: vi.fn(() => {
        throw storageError;
      }),
      setItem: vi.fn(() => {
        throw storageError;
      }),
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_removed" });
    await expectState("quiz-inactive");

    expect(routeMock.path).toBe("/guest");
  });

  it("ignores a provider event from an unrelated instance once scoped", async () => {
    setProviders("party", "music_quiz");
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("party");
    expect(apiMock.sendCommand).toHaveBeenCalledOnce();

    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    signalProviderEvent(
      { event: "game_updated", state: {} },
      "quiz-instance-1",
    );
    await expectState("quiz");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);

    signalProviderEvent({ event: "game_updated", state: {} }, "other-instance");
    await Promise.resolve();
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  async function expectState(expected: GuestEntryState) {
    await vi.waitFor(() => expect(resolverState.value).toBe(expected));
  }
});

function mountResolver(
  onSetup: (
    state: DeepReadonly<Ref<GuestEntryState>>,
    resolve: () => Promise<void>,
  ) => void,
) {
  return mount(
    defineComponent({
      setup() {
        const { state, resolve } = useGuestEntryResolver();
        onSetup(state, resolve);
        return () => h("div");
      },
    }),
  );
}

function setProviders(...domains: string[]) {
  apiMock.providers = Object.fromEntries(
    domains.map((domain) => [domain, { domain }]),
  );
}

function signalProviderEvent(data: unknown, objectId = "quiz-instance-1") {
  const callback = getSubscriber(EventType.PROVIDER_EVENT);
  callback({ event: EventType.PROVIDER_EVENT, object_id: objectId, data });
}

function signalProvidersUpdated() {
  const callback = getSubscriber(EventType.PROVIDERS_UPDATED);
  callback({ event: EventType.PROVIDERS_UPDATED });
}

function getSubscriber(eventType: EventType) {
  const call = apiMock.subscribe.mock.calls.find(
    ([event]) => event === eventType,
  );
  expect(call).toBeDefined();
  return call?.[1] as (event: unknown) => void;
}

function storeAffinity(guestIdentity: string) {
  sessionStorage.setItem(
    "music_quiz_guest_affinity",
    JSON.stringify({
      version: 2,
      connectionIdentity: "local:http://music-assistant:8095",
      participantIdentity: guestIdentity,
    }),
  );
}

function getStoredAffinity(): unknown {
  const value = sessionStorage.getItem("music_quiz_guest_affinity");
  return value === null ? null : JSON.parse(value);
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
