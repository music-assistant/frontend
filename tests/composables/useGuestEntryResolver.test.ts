import {
  resolveGuestEntry,
  useGuestEntryResolver,
  type GuestEntryState,
} from "@/composables/guest/useGuestEntryResolver";
import { EventType } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, type DeepReadonly, type Ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, routeState, routerReplace, storeMock } = vi.hoisted(() => {
  const routeState = { current: undefined as { path: string } | undefined };
  return {
    apiMock: {
      providers: {} as Record<string, { domain: string }>,
      sendCommand: vi.fn(),
      state: { value: "initialized" },
      subscribe: vi.fn(),
    },
    routeState,
    routerReplace: vi.fn(async (path: string) => {
      setRoutePath(path);
    }),
    storeMock: {
      enabledPlugins: new Set<string>(),
    },
  };
});

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  ConnectionState: { INITIALIZED: "initialized" },
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("vue-router", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  routeState.current = reactive({ path: "/guest" });
  return {
    useRoute: () => routeState.current,
    useRouter: () => ({ replace: routerReplace }),
  };
});

describe("guest entry decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.providers = {};
    storeMock.enabledPlugins = new Set();
    apiMock.sendCommand.mockResolvedValue(null);
    apiMock.subscribe.mockImplementation(() => () => {});
    setRoutePath("/guest");
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
  });

  it("propagates a music quiz info failure", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockRejectedValue(new Error("boom"));

    await expect(resolveGuestEntry()).rejects.toThrow("boom");
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

  it("ignores providers that are listed but not among the loaded plugins", async () => {
    // listed among the providers, but neither of them is loaded
    apiMock.providers = {
      party: { domain: "party" },
      music_quiz: { domain: "music_quiz" },
    };

    await expect(resolveGuestEntry()).resolves.toBe("inactive");
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });
});

describe("guest entry transitions", () => {
  let wrapper: ReturnType<typeof mount> | undefined;
  let resolverState: DeepReadonly<Ref<GuestEntryState>>;

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.providers = {};
    storeMock.enabledPlugins = new Set();
    apiMock.state.value = "initialized";
    apiMock.sendCommand.mockResolvedValue(null);
    apiMock.subscribe.mockImplementation(() => () => {});
    setRoutePath("/guest");
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("shows an error state when the initial resolution fails", async () => {
    setProviders("party", "music_quiz");
    setRoutePath("/guest/party");
    apiMock.sendCommand.mockRejectedValue(new Error("boom"));
    wrapper = mountResolver((state) => {
      resolverState = state;
    });

    await expectState("error");

    expect(getRoutePath()).toBe("/guest");
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
    expect(getRoutePath()).toBe("/guest/quiz");
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
    expect(getRoutePath()).toBe("/guest/quiz");
  });

  it("routes to Party once the Party provider appears", async () => {
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("inactive");

    setProviders("party");
    signalProvidersUpdated();

    await expectState("party");
    expect(getRoutePath()).toBe("/guest/party");
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("moves a Party guest into each new Quiz and back when it is removed", async () => {
    setProviders("party", "music_quiz");
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("party");

    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    signalProviderEvent({ event: "game_updated", state: {} });
    await expectState("quiz");

    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_removed" });
    await expectState("party");
    expect(getRoutePath()).toBe("/guest/party");

    apiMock.sendCommand.mockResolvedValue({ game_id: "next" });
    signalProviderEvent({ event: "game_updated", state: {} });
    await expectState("quiz");

    expect(routerReplace.mock.calls.map(([path]) => path)).toEqual([
      "/guest/party",
      "/guest/quiz",
      "/guest/party",
      "/guest/quiz",
    ]);
  });

  it("returns a Quiz guest to the Party when the game is removed", async () => {
    setProviders("music_quiz", "party");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_removed" });
    await expectState("party");

    expect(getRoutePath()).toBe("/guest/party");
  });

  it("shows the no-active Quiz state when the game is removed without a Party", async () => {
    setProviders("music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_removed" });
    await expectState("quiz-inactive");

    expect(getRoutePath()).toBe("/guest");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("resolves again when the game is removed during a refresh", async () => {
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
    await flushPromises();
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);

    signalProviderEvent({ event: "game_removed" });
    resolveRefresh(null);
    await expectState("quiz-inactive");

    expect(getRoutePath()).toBe("/guest");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
  });

  it("leaves the Quiz route when the game is removed while still loading", async () => {
    setProviders("music_quiz");
    setRoutePath("/guest/quiz");
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
    await flushPromises();
    expect(apiMock.sendCommand).toHaveBeenCalledOnce();
    expect(resolverState.value).toBe("loading");

    signalProviderEvent({ event: "game_removed" });
    resolveInitialRequest(null);
    await expectState("quiz-inactive");

    expect(getRoutePath()).toBe("/guest");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
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

    await flushPromises();
    expect(apiMock.sendCommand).toHaveBeenCalledOnce();

    signalProviderEvent({ event: "game_updated", state: {} });
    expect(apiMock.sendCommand).toHaveBeenCalledOnce();
    resolveFirstRequest(null);

    await expectState("quiz");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    expect(routerReplace).toHaveBeenCalledTimes(1);
    expect(routerReplace).toHaveBeenCalledWith("/guest/quiz");
  });

  it("does not let a stale active Quiz result override a newer game event", async () => {
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
    await flushPromises();
    expect(apiMock.sendCommand).toHaveBeenCalledOnce();

    signalProviderEvent({ event: "game_updated", state: {} });
    resolveFirstRequest({ game_id: "stale" });

    await expectState("party");
    expect(routerReplace).toHaveBeenCalledOnce();
    expect(routerReplace).toHaveBeenCalledWith("/guest/party");
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
    await flushPromises();
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("returns a guest who navigates away to the active Quiz route", async () => {
    setProviders("music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");
    expect(getRoutePath()).toBe("/guest/quiz");

    setRoutePath("/guest");

    await flushPromises();
    expect(getRoutePath()).toBe("/guest/quiz");
    expect(routerReplace.mock.calls.map(([path]) => path)).toEqual([
      "/guest/quiz",
      "/guest/quiz",
    ]);
  });

  async function expectState(expected: GuestEntryState) {
    await flushPromises();
    expect(resolverState.value).toBe(expected);
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

function getRoutePath() {
  return getRoute().path;
}

function setRoutePath(path: string) {
  getRoute().path = path;
}

function getRoute() {
  if (!routeState.current) throw new Error("vue-router mock is not set up");
  return routeState.current;
}

function setProviders(...domains: string[]) {
  apiMock.providers = Object.fromEntries(
    domains.map((domain) => [domain, { domain }]),
  );
  storeMock.enabledPlugins = new Set(domains);
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
