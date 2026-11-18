import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  Scope,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCoreLogLevels } from "./useCoreLogLevels";

const { apiMock, hasScope, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfigs: vi.fn<MusicAssistantApi["getCoreConfigs"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    providerManifests: {
      streams: { name: "Streamserver" },
      radio_tuner: { name: "Radio tuner" },
    } as Record<string, { name: string }>,
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

// the module names the app has a text for
const TEXTS: Record<string, string> = {
  "settings.core_module.streams.name": "Streams",
  "settings.core_module.cache.name": "Cache",
};

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => TEXTS[key] ?? key }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.getCoreConfigs.mockResolvedValue([
    moduleConfig("streams", "GLOBAL"),
    moduleConfig("radio_tuner", "DEBUG"),
    moduleConfig("cache", "INFO"),
  ]);
  apiMock.saveCoreConfig.mockImplementation(async (domain, values) =>
    moduleConfig(domain, String(values.log_level)),
  );
});

describe("useCoreLogLevels", () => {
  it("loads nothing for a user who may not change the core settings", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const logLevels = useCoreLogLevels();
    await flushPromises();

    expect(logLevels.canEdit).toBe(false);
    expect(apiMock.getCoreConfigs).not.toHaveBeenCalled();
    expect(logLevels.loaded.value).toBe(false);
  });

  it("shows the log level of every module the server reports, by the name of the module", async () => {
    const logLevels = useCoreLogLevels();
    await flushPromises();

    // the configs carry their entries only on request
    expect(apiMock.getCoreConfigs).toHaveBeenCalledWith(true);
    expect(logLevels.loaded.value).toBe(true);
    expect(
      logLevels.entries.value.map(({ key, label, value }) => ({
        key,
        label,
        value,
      })),
    ).toEqual([
      { key: "core/cache/log_level", label: "Cache", value: "INFO" },
      {
        key: "core/radio_tuner/log_level",
        label: "Radio tuner",
        value: "DEBUG",
      },
      { key: "core/streams/log_level", label: "Streams", value: "GLOBAL" },
    ]);
    expect(logLevels.entries.value[0].category_label).toBe(
      "settings.log_levels",
    );
  });

  it("reports a failed load without a toast of its own", async () => {
    apiMock.getCoreConfigs.mockRejectedValueOnce(new Error("offline"));

    const logLevels = useCoreLogLevels();
    await flushPromises();

    expect(logLevels.loadFailed.value).toBe(true);
    expect(logLevels.loaded.value).toBe(false);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("saves only the log levels that changed, each to its own module", async () => {
    const logLevels = useCoreLogLevels();
    await flushPromises();

    await expect(
      logLevels.save({
        "core/cache/log_level": "INFO",
        "core/radio_tuner/log_level": "GLOBAL",
        "core/streams/log_level": "VERBOSE",
      }),
    ).resolves.toBe(true);

    expect(apiMock.saveCoreConfig).toHaveBeenCalledTimes(2);
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("radio_tuner", {
      log_level: "GLOBAL",
    });
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("streams", {
      log_level: "VERBOSE",
    });
  });

  it("takes what a module stored as saved", async () => {
    const logLevels = useCoreLogLevels();
    await flushPromises();

    await logLevels.save({ "core/streams/log_level": "DEBUG" });
    apiMock.saveCoreConfig.mockClear();
    await logLevels.save({ "core/streams/log_level": "DEBUG" });

    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
  });

  it("sends a change again only to the module that did not store it", async () => {
    apiMock.saveCoreConfig.mockImplementation(async (domain, values) => {
      if (domain === "cache") throw new Error("refused");
      return moduleConfig(domain, String(values.log_level));
    });
    const logLevels = useCoreLogLevels();
    await flushPromises();
    const values = {
      "core/cache/log_level": "ERROR",
      "core/streams/log_level": "DEBUG",
    };

    await expect(logLevels.save(values)).resolves.toBe(false);
    apiMock.saveCoreConfig.mockClear();
    await logLevels.save(values);

    expect(apiMock.saveCoreConfig).toHaveBeenCalledExactlyOnceWith("cache", {
      log_level: "ERROR",
    });
  });
});

function moduleConfig(domain: string, logLevel: string): CoreConfig {
  const logLevelEntry: ConfigEntry = {
    key: "log_level",
    category: "generic",
    type: ConfigEntryType.STRING,
    label: "Log level",
    default_value: "GLOBAL",
    required: false,
    options: [],
    advanced: true,
    value: logLevel,
  };
  return {
    domain,
    last_error: null,
    values: { log_level: logLevelEntry },
  };
}
