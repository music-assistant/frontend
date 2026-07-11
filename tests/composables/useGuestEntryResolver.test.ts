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

const { apiMock, routeMock, routerReplace } = vi.hoisted(() => {
  const routeMock = { path: "/guest" };
  return {
    apiMock: {
      providers: {} as Record<string, { domain: string }>,
      sendCommand: vi.fn(),
      state: { value: "initialized" },
      subscribe: vi.fn(),
    },
    routeMock,
    routerReplace: vi.fn(async (path: string) => {
      routeMock.path = path;
    }),
  };
});

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  ConnectionState: { INITIALIZED: "initialized" },
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ replace: routerReplace }),
}));

describe("guest entry decisions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.providers = {};
    apiMock.sendCommand.mockResolvedValue(null);
    apiMock.subscribe.mockImplementation(() => () => {});
    routeMock.path = "/guest";
  });

  it("routes an active Music Quiz ahead of Party", async () => {
    setProviders("party", "music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });

    await expect(resolveGuestEntry()).resolves.toBe("quiz");
    expect(apiMock.sendCommand).toHaveBeenCalledWith("music_quiz/info");
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
    routeMock.path = "/guest";
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("moves from Party to Quiz and back through the empty states", async () => {
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

    setProviders("music_quiz");
    signalProvidersUpdated();
    await expectState("quiz-inactive");

    setProviders();
    signalProvidersUpdated();
    await expectState("inactive");

    expect(routerReplace.mock.calls.map(([path]) => path)).toEqual([
      "/guest/party",
      "/guest/quiz",
      "/guest/party",
      "/guest",
    ]);
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

  it("keeps a joined guest on the Quiz route when their game ends", async () => {
    setProviders("music_quiz");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    markMusicQuizJoinedGameEnded();
    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_removed" });
    await expectState("quiz-ended");

    expect(routeMock.path).toBe("/guest/quiz");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("routes an ended Quiz guest to an available Party", async () => {
    setProviders("music_quiz", "party");
    apiMock.sendCommand.mockResolvedValue({ game_id: "active" });
    wrapper = mountResolver((state) => {
      resolverState = state;
    });
    await expectState("quiz");

    markMusicQuizJoinedGameEnded();
    apiMock.sendCommand.mockResolvedValue(null);
    signalProviderEvent({ event: "game_removed" });
    await expectState("party");

    expect(routeMock.path).toBe("/guest/party");
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
    await expectState("quiz-ended");

    expect(routeMock.path).toBe("/guest/quiz");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
  });

  it("preserves an ended game while the guest route is still loading", async () => {
    setProviders("music_quiz");
    routeMock.path = "/guest/quiz";
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
    await expectState("quiz-ended");

    expect(routeMock.path).toBe("/guest/quiz");
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
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
  onSetup: (state: DeepReadonly<Ref<GuestEntryState>>) => void,
) {
  return mount(
    defineComponent({
      setup() {
        const { state } = useGuestEntryResolver();
        onSetup(state);
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
