import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import {
  type ConfigEntry,
  ConfigEntryType,
  type CoreConfig,
  ProviderType,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, reactive } from "vue";
import { providerConfig } from "../../tests/fixtures/providerConfig";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { type ConfigValueOwner, useConfigValue } from "./useConfigValue";

const { apiMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    getProviderConfig: vi.fn<MusicAssistantApi["getProviderConfig"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
    providers: {} as Record<string, unknown>,
  },
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", async () => {
  const { ApiCommandError } = await import("@/plugins/api/errors");
  return { api: apiMock, default: apiMock, ApiCommandError };
});
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const PLAYERS: ConfigValueOwner = { kind: "core", domain: "players" };
const QUIZ: ConfigValueOwner = {
  kind: "provider",
  domain: "music_quiz",
  instanceId: "music_quiz--1",
};
const KEY = "ai_engine";

let wrapper: ReturnType<typeof mount> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.providers = reactive({
    "music_quiz--1": providerInstance({
      type: ProviderType.PLUGIN,
      domain: "music_quiz",
    }),
  });
  apiMock.getCoreConfig.mockResolvedValue(coreConfig("global"));
  apiMock.getProviderConfig.mockResolvedValue(quizConfig("global"));
  apiMock.saveCoreConfig.mockImplementation(async (_domain, values) =>
    coreConfig(values[KEY] as string),
  );
  apiMock.saveProviderConfig.mockImplementation(async (_domain, values) =>
    quizConfig(values[KEY] as string),
  );
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

describe("useConfigValue", () => {
  it("loads the entry of a core module", async () => {
    const value = await mountValue(PLAYERS);

    expect(apiMock.getCoreConfig).toHaveBeenCalledExactlyOnceWith("players");
    expect(value.entry.value).toMatchObject({ key: KEY, value: "global" });
  });

  it("loads the entry of a provider instance", async () => {
    const value = await mountValue(QUIZ);

    expect(apiMock.getProviderConfig).toHaveBeenCalledExactlyOnceWith(
      "music_quiz--1",
    );
    expect(value.entry.value?.value).toBe("global");
  });

  it("saves the value of a core module alone, and says so", async () => {
    const value = await mountValue(PLAYERS);

    expect(await value.save("gpt")).toBe(true);

    expect(apiMock.saveCoreConfig).toHaveBeenCalledExactlyOnceWith(
      "players",
      { [KEY]: "gpt" },
      { suppressGlobalError: true },
    );
    expect(value.entry.value?.value).toBe("gpt");
    expect(toastMock.success).toHaveBeenCalledExactlyOnceWith(
      "settings.settings_saved",
    );
  });

  it("saves the value of a provider instance alone", async () => {
    const value = await mountValue(QUIZ);

    await value.save("gpt");

    expect(apiMock.saveProviderConfig).toHaveBeenCalledExactlyOnceWith(
      "music_quiz",
      { [KEY]: "gpt" },
      "music_quiz--1",
      { suppressGlobalError: true },
    );
  });

  it("shows the new value while it saves", async () => {
    let finish!: () => void;
    apiMock.saveCoreConfig.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = () => resolve(coreConfig("gpt"));
      }),
    );
    const value = await mountValue(PLAYERS);

    const saved = value.save("gpt");

    expect(value.entry.value?.value).toBe("gpt");
    expect(value.busy.value).toBe(true);
    finish();
    await saved;
    expect(value.busy.value).toBe(false);
  });

  it.each([
    ["with the reason the server gives", "No such engine", "No such engine"],
    ["without a reason", undefined, "settings.save_failed"],
  ])(
    "goes back to the stored value when the save fails, %s",
    async (_name, details, message) => {
      apiMock.saveCoreConfig.mockRejectedValueOnce(
        new ApiCommandError("refused", 1, details),
      );
      const value = await mountValue(PLAYERS);

      expect(await value.save("gpt")).toBe(false);

      expect(value.entry.value?.value).toBe("global");
      expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(message);
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(value.busy.value).toBe(false);
    },
  );

  it("does not save an unchanged value", async () => {
    const value = await mountValue(PLAYERS);

    expect(await value.save("global")).toBe(false);

    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
  });

  it("is busy while its provider is not loaded", async () => {
    const value = await mountValue(QUIZ);
    expect(value.busy.value).toBe(false);

    delete apiMock.providers["music_quiz--1"];

    expect(value.busy.value).toBe(true);
  });

  it("keeps its entry while its provider offers none", async () => {
    const value = await mountValue(QUIZ);
    // a provider that is not loaded only has the entries every provider has
    apiMock.getProviderConfig.mockResolvedValue(
      providerConfig({ domain: "music_quiz", instance_id: "music_quiz--1" }),
    );

    await value.reload();

    expect(value.entry.value?.value).toBe("global");
    expect(value.loadFailed.value).toBe(false);
  });

  it("takes the options the owner offers on a reload", async () => {
    const value = await mountValue(PLAYERS);
    apiMock.getCoreConfig.mockResolvedValue(coreConfig("global", ["gpt"]));

    await value.reload();

    expect(value.entry.value?.options.map((option) => option.value)).toEqual([
      "global",
      "gpt",
    ]);
  });

  it("ignores a load that was on its way when the value was saved", async () => {
    const value = await mountValue(PLAYERS);
    let finishLoad!: () => void;
    apiMock.getCoreConfig.mockReturnValueOnce(
      new Promise((resolve) => {
        finishLoad = () => resolve(coreConfig("global"));
      }),
    );

    const reloaded = value.reload();
    await value.save("gpt");
    finishLoad();
    await reloaded;

    expect(value.entry.value?.value).toBe("gpt");
  });

  it("reports an entry it could not load", async () => {
    apiMock.getCoreConfig.mockRejectedValue(new Error("offline"));

    const value = await mountValue(PLAYERS);

    expect(value.entry.value).toBeUndefined();
    expect(value.loadFailed.value).toBe(true);
  });
});

async function mountValue(owner: ConfigValueOwner) {
  let state!: ReturnType<typeof useConfigValue>;
  wrapper = mount(
    defineComponent({
      setup() {
        state = useConfigValue(owner, KEY);
        return () => null;
      },
    }),
  );
  await flushPromises();
  return state;
}

function engineEntry(value: string, engines: string[] = []): ConfigEntry {
  return {
    key: KEY,
    type: ConfigEntryType.STRING,
    label: "AI engine",
    default_value: "global",
    required: false,
    category: "generic",
    options: [
      { title: "OpenAI | gpt", value: "global" },
      ...engines.map((engine) => ({ title: engine, value: engine })),
    ],
    value,
  };
}

function coreConfig(value: string, engines?: string[]): CoreConfig {
  return {
    domain: "players",
    last_error: null,
    values: { [KEY]: engineEntry(value, engines) },
  };
}

function quizConfig(value: string) {
  return providerConfig({
    type: ProviderType.PLUGIN,
    domain: "music_quiz",
    instance_id: "music_quiz--1",
    values: { [KEY]: engineEntry(value) },
  });
}
