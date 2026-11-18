import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  Scope,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsPage } from "./useSettingsPage";

const { apiMock, hasScope, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    invokeCoreConfigAction:
      vi.fn<MusicAssistantApi["invokeCoreConfigAction"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.getCoreConfig.mockResolvedValue(streamsConfig());
  apiMock.saveCoreConfig.mockImplementation(async (domain, values) =>
    streamsConfig(values),
  );
});

describe("useSettingsPage", () => {
  it("loads nothing for a user who may not change the settings", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    expect(page.canEdit).toBe(false);
    expect(apiMock.getCoreConfig).not.toHaveBeenCalled();
    expect(page.loaded.value).toBe(false);
  });

  it("shows only the settings the page claims", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    expect(apiMock.getCoreConfig).toHaveBeenCalledWith("streams");
    expect(page.loaded.value).toBe(true);
    expect(page.entries.value.map((entry) => entry.key)).toEqual([
      "background_scan_concurrency",
      "smart_fades_log_level",
    ]);
  });

  it("reports a failed load without a toast of its own", async () => {
    apiMock.getCoreConfig.mockRejectedValueOnce(new Error("offline"));

    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    expect(page.loadFailed.value).toBe(true);
    expect(page.loaded.value).toBe(false);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("saves only what changed, to the owner of the settings", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await expect(
      page.save({
        background_scan_concurrency: 4,
        smart_fades_log_level: "GLOBAL",
      }),
    ).resolves.toBe(true);

    expect(apiMock.saveCoreConfig).toHaveBeenCalledExactlyOnceWith("streams", {
      background_scan_concurrency: 4,
    });
  });

  it("takes what the server stored as saved", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();
    await page.save({ background_scan_concurrency: 4 });

    await expect(page.save({ background_scan_concurrency: 4 })).resolves.toBe(
      true,
    );

    expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
  });

  it("sends a reset to the default", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await page.save({ background_scan_concurrency: null });

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith("streams", {
      background_scan_concurrency: null,
    });
  });

  it("makes no call when nothing changed", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await expect(
      page.save({ background_scan_concurrency: 2, bind_port: 1234 }),
    ).resolves.toBe(true);

    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
  });

  it("reports a save that did not land", async () => {
    apiMock.saveCoreConfig.mockRejectedValueOnce(new Error("refused"));
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await expect(page.save({ background_scan_concurrency: 4 })).resolves.toBe(
      false,
    );
    expect(page.busy.value).toBe(false);
  });

  it("runs an action on the owner of its entry and shows what it returns", async () => {
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce(
      Object.values(
        streamsConfig({ background_scan_concurrency: 8 }).values,
      ).map((entry) =>
        entry.key === "background_scan_concurrency"
          ? { ...entry, action: "suggest_concurrency" }
          : entry,
      ),
    );
    const page = useSettingsPage("audio_analysis");
    await flushPromises();
    page.entries.value[0].action = "suggest_concurrency";

    await page.onAction("suggest_concurrency", {}, false);

    expect(apiMock.invokeCoreConfigAction).toHaveBeenCalledWith(
      "streams",
      "suggest_concurrency",
    );
    expect(page.entries.value.map((entry) => entry.key)).toEqual([
      "background_scan_concurrency",
      "smart_fades_log_level",
    ]);
    expect(page.entries.value[0].value).toBe(8);
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
  });
});

function entry(
  key: string,
  category: string,
  value: ConfigEntry["value"],
): ConfigEntry {
  return {
    key,
    category,
    type: ConfigEntryType.INTEGER,
    label: key,
    default_value: null,
    required: false,
    options: [],
    value,
  };
}

function streamsConfig(
  overrides: Record<string, ConfigEntry["value"]> = {},
): CoreConfig {
  const values: Record<string, ConfigEntry["value"]> = {
    bind_port: 8097,
    background_scan_concurrency: 2,
    smart_fades_log_level: "GLOBAL",
    ...overrides,
  };
  return {
    domain: "streams",
    last_error: null,
    values: {
      bind_port: entry("bind_port", "generic", values.bind_port),
      background_scan_concurrency: entry(
        "background_scan_concurrency",
        "audio_analysis",
        values.background_scan_concurrency,
      ),
      smart_fades_log_level: entry(
        "smart_fades_log_level",
        "audio_analysis",
        values.smart_fades_log_level,
      ),
    },
  };
}
