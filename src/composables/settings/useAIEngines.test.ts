import type { MusicAssistantApi } from "@/plugins/api";
import {
  type AIEngine,
  AIEngineKind,
  type AIEngineUsage,
  EventType,
  Scope,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { useAIEngines } from "./useAIEngines";

const { apiMock, hasScope } = vi.hoisted(() => ({
  apiMock: {
    getAIEngines: vi.fn<MusicAssistantApi["getAIEngines"]>(),
    getAIUsage: vi.fn<MusicAssistantApi["getAIUsage"]>(),
    subscribe: vi.fn(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

const GPT: AIEngine = {
  uid: "gpt",
  name: "OpenAI | gpt",
  kind: AIEngineKind.TEXT,
  provider: "openai_compatible--1",
};
const ANNOUNCEMENTS: AIEngineUsage = {
  owner_type: "core",
  owner: "players",
  domain: "players",
  name: "Players",
  key: "announce_tts_engine",
  kind: AIEngineKind.SPEECH,
  in_setup_data: false,
  follows_default: true,
  engine: null,
};

let unsubscribe: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  hasScope.mockReturnValue(true);
  apiMock.getAIEngines.mockResolvedValue([GPT]);
  apiMock.getAIUsage.mockResolvedValue([ANNOUNCEMENTS]);
  unsubscribe = vi.fn();
  apiMock.subscribe.mockReturnValue(unsubscribe);
});

afterEach(() => {
  vi.useRealTimers();
});

function mountComposable() {
  let state!: ReturnType<typeof useAIEngines>;
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useAIEngines();
        return () => null;
      },
    }),
  );
  return { wrapper, state };
}

// the listener the composable subscribed to provider updates with
function providersUpdated(): () => void {
  const [, listener] = apiMock.subscribe.mock.calls.find(
    ([event]) => event === EventType.PROVIDERS_UPDATED,
  )!;
  return listener;
}

describe("useAIEngines", () => {
  it("loads the engines and what uses them", async () => {
    const { state } = mountComposable();
    await flushPromises();

    expect(state.loaded.value).toBe(true);
    expect(state.engines.value).toEqual([GPT]);
    expect(state.usage.value).toEqual([ANNOUNCEMENTS]);
  });

  it("loads again once after a burst of provider updates", async () => {
    mountComposable();
    await flushPromises();
    apiMock.getAIEngines.mockClear();

    providersUpdated()();
    providersUpdated()();
    await vi.runAllTimersAsync();

    expect(apiMock.getAIEngines).toHaveBeenCalledOnce();
  });

  it("loads again on request", async () => {
    const { state } = mountComposable();
    await flushPromises();
    apiMock.getAIUsage.mockResolvedValue([]);

    await state.refresh();

    expect(state.usage.value).toEqual([]);
  });

  it("keeps the latest answer when an earlier one comes in last", async () => {
    let answerFirst!: (engines: AIEngine[]) => void;
    apiMock.getAIEngines.mockReturnValueOnce(
      new Promise((resolve) => (answerFirst = resolve)),
    );
    const { state } = mountComposable();

    apiMock.getAIEngines.mockResolvedValueOnce([]);
    await state.refresh();
    answerFirst([GPT]);
    await flushPromises();

    expect(state.engines.value).toEqual([]);
  });

  it("keeps what it has when a later load fails", async () => {
    const { state } = mountComposable();
    await flushPromises();
    apiMock.getAIEngines.mockRejectedValueOnce(new Error("offline"));

    await state.refresh();

    expect(state.loadFailed.value).toBe(false);
    expect(state.engines.value).toEqual([GPT]);
  });

  it("reports a first load that fails", async () => {
    apiMock.getAIEngines.mockRejectedValueOnce(new Error("offline"));

    const { state } = mountComposable();
    await flushPromises();

    expect(state.loadFailed.value).toBe(true);
    expect(state.loaded.value).toBe(false);
  });

  it("stops listening when its component goes", async () => {
    const { wrapper } = mountComposable();

    wrapper.unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("loads nothing for a user who may not read the engines", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_READ);

    const { state } = mountComposable();
    await flushPromises();

    expect(apiMock.getAIEngines).not.toHaveBeenCalled();
    expect(apiMock.subscribe).not.toHaveBeenCalled();
    expect(state.loaded.value).toBe(false);
  });
});
