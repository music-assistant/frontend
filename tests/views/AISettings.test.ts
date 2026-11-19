import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type AIEngine,
  AIEngineKind,
  type AIEngineUsage,
  EventType,
  ProviderFeature,
  type ProviderInstance,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import AISettings from "@/views/settings/AISettings.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import { providerInstance } from "../fixtures/providerInstance";

const { apiMock, hasScope } = vi.hoisted(() => ({
  apiMock: {
    getAIEngines: vi.fn<MusicAssistantApi["getAIEngines"]>(),
    getAIUsage: vi.fn<MusicAssistantApi["getAIUsage"]>(),
    subscribe: vi.fn(),
    providers: {} as Record<string, ProviderInstance>,
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

// the form and the switch are covered where they live
const settingsPageFormStub = {
  name: "SettingsPageForm",
  props: { page: String },
  emits: ["saved"],
  template: "<div data-testid='settings-page-form' />",
};
const aiEngineUsageStub = {
  name: "AIEngineUsage",
  props: { usage: Array, engines: Array },
  emits: ["changed"],
  template: "<div />",
};
const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};
const addProviderDialogStub = {
  name: "AddProviderDialog",
  props: { show: Boolean, providerType: String, aiServiceOnly: Boolean },
  emits: ["update:show"],
  template: "<div />",
};

const GPT = engine("gpt", AIEngineKind.TEXT);
const NOVA = engine("nova", AIEngineKind.SPEECH);

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.getAIEngines.mockResolvedValue([GPT, NOVA]);
  apiMock.getAIUsage.mockResolvedValue([
    usage({ owner: "ai_radio--1", name: "AI Radio", in_setup_data: true }),
    usage({ owner: "smart_playlist--1", name: "Smart playlists" }),
  ]);
  apiMock.subscribe.mockReturnValue(vi.fn());
  // reactive, as the api keeps them
  apiMock.providers = reactive({
    "openai_compatible--1": providerInstance({
      type: ProviderType.PLUGIN,
      domain: "openai_compatible",
      name: "OpenAI",
      supported_features: [ProviderFeature.AI_QUERY, ProviderFeature.TTS],
    }),
    "party--1": providerInstance({
      type: ProviderType.PLUGIN,
      domain: "party",
    }),
  });
});

describe("AISettings", () => {
  it("heads the page with the header of AI", async () => {
    const wrapper = await mountPage();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe("ai");
  });

  it("shows the default engines while there are engines", async () => {
    const wrapper = await mountPage();

    expect(wrapper.getComponent(settingsPageFormStub).props("page")).toBe("ai");
    expect(wrapper.find('[data-testid="ai-no-engines"]').exists()).toBe(false);
  });

  it("invites adding an AI service while there are no engines", async () => {
    apiMock.getAIEngines.mockResolvedValue([]);

    const wrapper = await mountPage();

    expect(wrapper.find('[data-testid="settings-page-form"]').exists()).toBe(
      false,
    );
    const empty = wrapper.get('[data-testid="ai-no-engines"]');
    expect(empty.text()).toContain("settings.ai.no_engines");
    await expectAddsAIService(wrapper, '[data-testid="ai-no-engines-add"]');
    // a service without models still asks for them, without a second offer
    expect(rowKeys(wrapper, "ai-services")).toEqual(["openai_compatible--1"]);
    expect(wrapper.find('[data-testid="ai-services-add"]').exists()).toBe(
      false,
    );
  });

  it("loads the engines again once the defaults are saved", async () => {
    const wrapper = await mountPage();
    apiMock.getAIUsage.mockClear();

    wrapper.getComponent(settingsPageFormStub).vm.$emit("saved");
    await flushPromises();

    expect(apiMock.getAIUsage).toHaveBeenCalledOnce();
  });

  it("reloads the form when other engines come", async () => {
    vi.useFakeTimers();
    try {
      const wrapper = await mountPage();
      const form = wrapper.getComponent(settingsPageFormStub);
      const [event, onProvidersUpdated] = apiMock.subscribe.mock.calls[0];
      expect(event).toBe(EventType.PROVIDERS_UPDATED);

      apiMock.getAIEngines.mockResolvedValue([GPT]);
      onProvidersUpdated();
      await vi.runAllTimersAsync();
      await flushPromises();

      expect(wrapper.getComponent(settingsPageFormStub)).not.toBe(form);
    } finally {
      vi.useRealTimers();
    }
  });

  it("hands what uses AI to its section, and reloads when it changes", async () => {
    const wrapper = await mountPage();
    const section = wrapper.getComponent(aiEngineUsageStub);
    expect(section.props()).toEqual({
      usage: await apiMock.getAIUsage.mock.results[0].value,
      engines: [GPT, NOVA],
    });
    apiMock.getAIUsage.mockClear();

    section.vm.$emit("changed");
    await flushPromises();

    expect(apiMock.getAIUsage).toHaveBeenCalledOnce();
  });

  it("lists the services providing engines, and offers to add one", async () => {
    const wrapper = await mountPage();

    expect(rowKeys(wrapper, "ai-services")).toEqual(["openai_compatible--1"]);
    expect(
      wrapper
        .get('[data-testid="ai-services-link-openai_compatible--1"]')
        .text(),
    ).toContain(
      "settings.ai.engine_count.text · settings.ai.engine_count.speech",
    );
    await expectAddsAIService(wrapper, '[data-testid="ai-services-add"]');
  });

  it("lists a service once it is added, without leaving the page", async () => {
    vi.useFakeTimers();
    try {
      apiMock.getAIEngines.mockResolvedValue([]);
      const wrapper = await mountPage();
      const [, onProvidersUpdated] = apiMock.subscribe.mock.calls[0];

      apiMock.providers["openai_compatible--2"] = providerInstance({
        instance_id: "openai_compatible--2",
        type: ProviderType.PLUGIN,
        domain: "openai_compatible",
        name: "OpenRouter",
        supported_features: [ProviderFeature.AI_QUERY],
      });
      apiMock.getAIEngines.mockResolvedValue([GPT]);
      onProvidersUpdated();
      await vi.runAllTimersAsync();
      await flushPromises();

      expect(rowKeys(wrapper, "ai-services")).toEqual([
        "openai_compatible--1",
        "openai_compatible--2",
      ]);
      expect(wrapper.find('[data-testid="ai-no-engines"]').exists()).toBe(
        false,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("says so when the engines could not be loaded", async () => {
    apiMock.getAIEngines.mockRejectedValue(new Error("offline"));

    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("settings.settings_load_failed");
    expect(wrapper.find('[data-testid="settings-page-form"]').exists()).toBe(
      false,
    );
  });

  it("reserves the room for the page while it loads", () => {
    apiMock.getAIEngines.mockReturnValue(new Promise(() => {}));

    const wrapper = mount(AISettings, { global: { stubs: STUBS } });

    expect(wrapper.find(".min-h-24").exists()).toBe(true);
  });
});

const STUBS = {
  AIAssistantAccess: true,
  AIEngineUsage: aiEngineUsageStub,
  AddProviderDialog: addProviderDialogStub,
  SettingsPageForm: settingsPageFormStub,
  RouterLink: RouterLinkStub,
};

async function mountPage() {
  const wrapper = mount(AISettings, { global: { stubs: STUBS } });
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountPage>>;

function rowKeys(wrapper: Wrapper, prefix: string) {
  const start = `${prefix}-link-`;
  return wrapper
    .findAll(`[data-testid^="${start}"]`)
    .map((found) => found.attributes("data-testid")!.slice(start.length));
}

// the button opens the dialog adding an AI service, on the page itself
async function expectAddsAIService(wrapper: Wrapper, button: string) {
  const dialog = wrapper.getComponent(addProviderDialogStub);
  expect(dialog.props()).toEqual({
    show: false,
    providerType: ProviderType.PLUGIN,
    aiServiceOnly: true,
  });

  await wrapper.get(button).trigger("click");

  expect(dialog.props("show")).toBe(true);
}

function engine(uid: string, kind: AIEngineKind): AIEngine {
  return {
    uid,
    name: `OpenAI | ${uid}`,
    kind,
    provider: "openai_compatible--1",
  };
}

function usage(overrides: Partial<AIEngineUsage>): AIEngineUsage {
  return {
    owner_type: "provider",
    owner: "smart_playlist--1",
    domain: "smart_playlist",
    name: "Smart playlists",
    key: "ai_engine",
    kind: AIEngineKind.TEXT,
    in_setup_data: false,
    follows_default: true,
    engine: "gpt",
    ...overrides,
  };
}
