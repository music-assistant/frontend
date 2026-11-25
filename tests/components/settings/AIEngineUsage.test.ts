import AIEngineUsage from "@/components/settings/ai/AIEngineUsage.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type AIEngine,
  AIEngineKind,
  type AIEngineUsage as EngineUsage,
  type ConfigEntry,
  ConfigEntryType,
  type CoreConfig,
  ProviderType,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { providerConfig } from "../../fixtures/providerConfig";
import { providerInstance } from "../../fixtures/providerInstance";

const { apiMock, eventbusMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    getProviderConfig: vi.fn<MusicAssistantApi["getProviderConfig"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
    providers: {} as Record<string, unknown>,
  },
  eventbusMock: { emit: vi.fn() },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

enableAutoUnmount(afterEach);

// the field is covered where it lives; this one shows what it is given
const configEntryFieldStub = {
  name: "ConfigEntryField",
  props: { confEntry: Object, disabled: Boolean, clearable: Boolean },
  emits: ["update:value"],
  template: "<div data-testid='field'>{{ confEntry.value }}</div>",
};

const GPT = engine("gpt", AIEngineKind.TEXT);
const NOVA = engine("nova", AIEngineKind.SPEECH);

const ANNOUNCEMENTS = usage({
  owner_type: "core",
  owner: "players",
  domain: "players",
  name: "Players",
  key: "announce_tts_engine",
  kind: AIEngineKind.SPEECH,
  engine: "nova",
});
const QUIZ = usage({ owner: "music_quiz--1", domain: "music_quiz" });
const RADIO = usage({
  owner: "ai_radio--1",
  domain: "ai_radio",
  name: "AI Radio",
  in_setup_data: true,
});

// the stored value of each setting, by owner
let stored: Record<string, string>;

beforeEach(() => {
  vi.clearAllMocks();
  stored = { players: "global", "music_quiz--1": "global" };
  apiMock.providers = reactive({
    "music_quiz--1": plugin("music_quiz"),
    "ai_radio--1": plugin("ai_radio"),
  });
  apiMock.getCoreConfig.mockImplementation(async (domain) =>
    coreConfig(domain),
  );
  apiMock.getProviderConfig.mockImplementation(async (instanceId) =>
    quizConfig(instanceId),
  );
  apiMock.saveCoreConfig.mockImplementation(async (domain, values) => {
    stored[domain] = values.announce_tts_engine as string;
    return coreConfig(domain);
  });
  apiMock.saveProviderConfig.mockImplementation(
    async (_domain, values, instanceId) => {
      stored[instanceId!] = values.ai_engine as string;
      return quizConfig(instanceId!);
    },
  );
});

describe("AIEngineUsage", () => {
  it("lists what uses AI, picking each engine with its owner's entry", async () => {
    const wrapper = await mountUsage([ANNOUNCEMENTS, RADIO, QUIZ]);

    expect(rowKeys(wrapper)).toEqual([
      "players/announce_tts_engine",
      "ai_radio--1/ai_engine",
      "music_quiz--1/ai_engine",
    ]);
    expect(apiMock.getCoreConfig).toHaveBeenCalledExactlyOnceWith("players");
    expect(apiMock.getProviderConfig).toHaveBeenCalledExactlyOnceWith(
      "music_quiz--1",
    );
    const field = picker(wrapper, "music_quiz--1/ai_engine").getComponent(
      configEntryFieldStub,
    );
    expect(field.props("confEntry")).toMatchObject({
      key: "ai_engine",
      value: "global",
    });
    // following the default is one of the options, not an empty field
    expect(field.props("clearable")).toBe(false);
  });

  it("saves a core module's engine on the spot", async () => {
    const wrapper = await mountUsage([ANNOUNCEMENTS]);

    pickEngine(wrapper, "players/announce_tts_engine", "nova");
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledExactlyOnceWith(
      "players",
      { announce_tts_engine: "nova" },
      { suppressGlobalError: true },
    );
    expect(toastMock.success).toHaveBeenCalledOnce();
    // the server sends no event for it, so the page loads the usage again
    expect(wrapper.emitted("changed")).toHaveLength(1);
  });

  it("starts the setup of a provider for a setting stored there", async () => {
    const wrapper = await mountUsage([RADIO]);

    await row(wrapper, "ai_radio--1/ai_engine").trigger("click");

    expect(eventbusMock.emit).toHaveBeenCalledExactlyOnceWith(
      "setupFlowDialog",
      expect.objectContaining({
        kind: "reconfigure",
        instanceId: "ai_radio--1",
        name: "AI Radio",
      }),
    );
    eventbusMock.emit.mock.calls[0][1].onFlowEnded();
    expect(wrapper.emitted("changed")).toHaveLength(1);
  });

  it("calmly says no engine of a kind is available", async () => {
    const wrapper = await mountUsage([ANNOUNCEMENTS], [GPT]);

    const found = row(wrapper, "players/announce_tts_engine");
    expect(found.find('[data-testid^="ai-engine-picker-"]').exists()).toBe(
      false,
    );
    expect(found.text()).toContain("settings.ai.not_available");
    expect(found.find(".text-destructive").exists()).toBe(false);
  });

  it("says under its picker that the engine a setting selects is gone", async () => {
    const wrapper = await mountUsage([
      ANNOUNCEMENTS,
      { ...QUIZ, engine: "removed" },
    ]);

    const missing = row(wrapper, "music_quiz--1/ai_engine");
    expect(
      picker(wrapper, "music_quiz--1/ai_engine")
        .get('[data-testid="ai-engine-unavailable"]')
        .text(),
    ).toBe("settings.ai.engine_unavailable");
    // the setting itself is not what is unavailable
    const description = missing.get('[data-testid="ai-usage-description"]');
    expect(description.text()).toBe("");
    expect(description.classes()).not.toContain("text-destructive");
    expect(
      picker(wrapper, "players/announce_tts_engine")
        .find('[data-testid="ai-engine-unavailable"]')
        .exists(),
    ).toBe(false);
  });

  it("loads a picker again when its setting is listed anew", async () => {
    const wrapper = await mountUsage([QUIZ]);
    stored["music_quiz--1"] = "claude";

    // the page lists the usage again when engines come and go
    await wrapper.setProps({ usage: [{ ...QUIZ }] });
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(picker(wrapper, "music_quiz--1/ai_engine").text()).toBe("claude");
  });

  it("names the engine when its picker cannot be loaded", async () => {
    apiMock.getProviderConfig.mockRejectedValue(new Error("offline"));

    const wrapper = await mountUsage([QUIZ]);

    expect(picker(wrapper, "music_quiz--1/ai_engine").text()).toBe(
      "settings.ai.follows_default",
    );
  });

  describe("a provider restarting to apply its new engine", () => {
    it("keeps its row with the new engine until it is back", async () => {
      const wrapper = await mountUsage([ANNOUNCEMENTS, QUIZ]);
      pickEngine(wrapper, "music_quiz--1/ai_engine", "gpt");
      await flushPromises();
      // a provider restarts on its own, without the page loading the usage
      expect(wrapper.emitted("changed")).toBeUndefined();

      // the server lists the settings of loaded providers only
      delete apiMock.providers["music_quiz--1"];
      await wrapper.setProps({ usage: [ANNOUNCEMENTS] });

      expect(rowKeys(wrapper)).toEqual([
        "players/announce_tts_engine",
        "music_quiz--1/ai_engine",
      ]);
      const restarting = picker(wrapper, "music_quiz--1/ai_engine");
      expect(restarting.attributes("aria-busy")).toBe("true");
      expect(restarting.text()).toBe("gpt");

      apiMock.providers["music_quiz--1"] = plugin("music_quiz");
      await wrapper.setProps({
        usage: [ANNOUNCEMENTS, { ...QUIZ, follows_default: false }],
      });
      await flushPromises();

      const back = picker(wrapper, "music_quiz--1/ai_engine");
      expect(back.attributes("aria-busy")).toBe("false");
      expect(back.text()).toBe("gpt");
    });

    it("lets it go once it is back, so a later removal drops its row", async () => {
      const wrapper = await mountUsage([QUIZ]);
      pickEngine(wrapper, "music_quiz--1/ai_engine", "gpt");
      await flushPromises();
      // a restart quick enough for one listing of the usage
      delete apiMock.providers["music_quiz--1"];
      await flushPromises();
      apiMock.providers["music_quiz--1"] = plugin("music_quiz");
      await wrapper.setProps({ usage: [{ ...QUIZ }] });

      await wrapper.setProps({ usage: [] });

      expect(rowKeys(wrapper)).toEqual([]);
    });

    it("drops the rows of a provider that went away without a save here", async () => {
      const wrapper = await mountUsage([ANNOUNCEMENTS, QUIZ]);

      await wrapper.setProps({ usage: [ANNOUNCEMENTS] });

      expect(rowKeys(wrapper)).toEqual(["players/announce_tts_engine"]);
    });
  });
});

async function mountUsage(
  settings: EngineUsage[],
  engines: AIEngine[] = [GPT, NOVA],
) {
  const wrapper = mount(AIEngineUsage, {
    props: { usage: settings, engines },
    global: { stubs: { ConfigEntryField: configEntryFieldStub } },
  });
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountUsage>>;

function rowKeys(wrapper: Wrapper) {
  const start = "ai-usage-link-";
  return wrapper
    .findAll(`[data-testid^="${start}"]`)
    .map((found) => found.attributes("data-testid")!.slice(start.length));
}

function row(wrapper: Wrapper, key: string) {
  return wrapper.get(`[data-testid="ai-usage-link-${key}"]`);
}

function picker(wrapper: Wrapper, key: string) {
  return wrapper.get(`[data-testid="ai-engine-picker-${key}"]`);
}

function pickEngine(wrapper: Wrapper, key: string, value: string) {
  picker(wrapper, key)
    .getComponent(configEntryFieldStub)
    .vm.$emit("update:value", value);
}

function plugin(domain: string) {
  return providerInstance({
    type: ProviderType.PLUGIN,
    domain,
    instance_id: `${domain}--1`,
  });
}

function engine(uid: string, kind: AIEngineKind): AIEngine {
  return {
    uid,
    name: `OpenAI | ${uid}`,
    kind,
    provider: "openai_compatible--1",
  };
}

function usage(overrides: Partial<EngineUsage>): EngineUsage {
  return {
    owner_type: "provider",
    owner: "smart_playlist--1",
    domain: "smart_playlist",
    name: "Music Quiz",
    key: "ai_engine",
    kind: AIEngineKind.TEXT,
    in_setup_data: false,
    follows_default: true,
    engine: "gpt",
    ...overrides,
  };
}

function engineEntry(key: string, value: string): ConfigEntry {
  return {
    key,
    type: ConfigEntryType.STRING,
    label: "AI engine",
    default_value: "global",
    required: false,
    category: "generic",
    options: [{ title: "OpenAI | gpt", value: "global" }],
    value,
  };
}

function coreConfig(domain: string): CoreConfig {
  return {
    domain,
    last_error: null,
    values: {
      announce_tts_engine: engineEntry("announce_tts_engine", stored[domain]),
    },
  };
}

// a provider that is not loaded has none of its own entries
function quizConfig(instanceId: string) {
  return providerConfig({
    type: ProviderType.PLUGIN,
    domain: "music_quiz",
    instance_id: instanceId,
    values:
      instanceId in apiMock.providers
        ? { ai_engine: engineEntry("ai_engine", stored[instanceId]) }
        : {},
  });
}
