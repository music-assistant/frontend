import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConfigAction } from "@/composables/useConfigAction";
import {
  ConfigEntryType,
  type ConfigActionResult,
  type ConfigEntry,
  type ConfigValueType,
  ProviderTier,
} from "@/plugins/api/interfaces";

const { apiMock, showActionResultMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    baseUrl: "",
    serverInfo: { value: null },
    getProviderManifest: vi.fn(),
  },
  showActionResultMock: vi.fn(),
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));

vi.mock("vue-sonner", () => ({
  toast: toastMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/action_result", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/helpers/action_result")>();
  showActionResultMock.mockImplementation(actual.showActionResult);
  return { ...actual, showActionResult: showActionResultMock };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useConfigAction", () => {
  it("shows a toast and leaves the form untouched when an action returns no entries", async () => {
    const { config, loading, invokeAction, saveValues, onAction } = setup();
    invokeAction.mockResolvedValueOnce([]);

    await onAction("do_thing", {}, false);

    expect(invokeAction).toHaveBeenCalledWith("do_thing");
    expect(config.value!.values).toEqual({ existing: entry() });
    expect(saveValues).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith("settings.action_completed");
    expect(loading.value).toBe(false);
  });

  it("merges the entries an action returned into the form", async () => {
    const { config, saveValues, invokeAction, onAction } = setup();
    invokeAction.mockResolvedValueOnce([entry({ key: "fresh", value: "new" })]);

    await onAction("do_thing", {}, false);

    expect(config.value!.values).toEqual({
      fresh: expect.objectContaining({ key: "fresh", value: "new" }),
    });
    expect(saveValues).not.toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("saves the merged values and takes back the stored ones on immediate_apply", async () => {
    const { config, saveValues, invokeAction, onAction } = setup();
    invokeAction.mockResolvedValueOnce([entry({ key: "fresh", value: "new" })]);
    saveValues.mockResolvedValueOnce({
      values: { fresh: entry({ key: "fresh", value: "stored" }) },
    });

    await onAction("do_thing", {}, true);

    expect(saveValues).toHaveBeenCalledWith({ fresh: "new" });
    expect(config.value!.values.fresh.value).toBe("stored");
  });

  it("opens url entries and keeps them out of the form", async () => {
    const openSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const { config, invokeAction, onAction } = setup();
    invokeAction.mockResolvedValueOnce([
      entry({
        key: "auth_url",
        type: ConfigEntryType.URL,
        value: "https://example.com/auth",
      }),
      entry({ key: "fresh", value: "new" }),
    ]);

    await onAction("do_thing", {}, false);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(Object.keys(config.value!.values)).toEqual(["fresh"]);
    openSpy.mockRestore();
  });

  it("toasts the localized message of an action result", async () => {
    const { config, loading, invokeAction, saveValues, onAction } = setup();
    invokeAction.mockResolvedValueOnce({
      message: "Kopieer deze url naar je client",
      open_url: null,
    });

    await onAction("do_thing", {}, true);

    expect(config.value!.values).toEqual({ existing: entry() });
    expect(saveValues).not.toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith(
      "Kopieer deze url naar je client",
    );
    expect(loading.value).toBe(false);
  });

  it("opens the url of an action result and falls back to the generic message", async () => {
    const openSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const { config, invokeAction, onAction } = setup();
    invokeAction.mockResolvedValueOnce({
      message: null,
      open_url: "https://example.com/mcp",
    });

    await onAction("do_thing", {}, false);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(config.value!.values).toEqual({ existing: entry() });
    expect(toastMock.success).toHaveBeenCalledWith("settings.action_completed");
    openSpy.mockRestore();
  });

  it("tells the result handling which provider answered the action", async () => {
    const answeredBy = vi.fn((action: string) => `domain_of_${action}`);
    const { invokeAction, onAction } = setup(answeredBy);
    const answer = { message: "Done", open_url: null };
    invokeAction.mockResolvedValueOnce(answer);

    await onAction("do_thing", {}, false);

    expect(showActionResultMock).toHaveBeenCalledExactlyOnceWith(
      answer,
      "domain_of_do_thing",
    );
  });

  describe("a url entry of a community provider", () => {
    const ownUrl = () => `${window.location.origin}/raw_route`;
    let click: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      apiMock.getProviderManifest.mockReturnValue({
        tier: ProviderTier.COMMUNITY,
      });
      click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
    });

    afterEach(() => {
      click.mockRestore();
    });

    it("is not opened when it leads to the app's own address", async () => {
      const { config, invokeAction, onAction } = setup(() => "community_demo");
      invokeAction.mockResolvedValueOnce([
        entry({ key: "page", type: ConfigEntryType.URL, value: ownUrl() }),
      ]);

      await onAction("do_thing", {}, false);

      expect(apiMock.getProviderManifest).toHaveBeenCalledWith(
        "community_demo",
      );
      expect(click).not.toHaveBeenCalled();
      expect(toastMock.warning).toHaveBeenCalledExactlyOnceWith(
        "settings.action_completed",
        { description: "settings.action_link_refused" },
      );
      expect(toastMock.success).not.toHaveBeenCalled();
      expect(config.value!.values).toEqual({ existing: entry() });
    });

    it("still re-renders the rest of the answer", async () => {
      const { config, invokeAction, onAction } = setup(() => "community_demo");
      invokeAction.mockResolvedValueOnce([
        entry({ key: "page", type: ConfigEntryType.URL, value: ownUrl() }),
        entry({ key: "fresh", value: "new" }),
      ]);

      await onAction("do_thing", {}, false);

      expect(click).not.toHaveBeenCalled();
      expect(Object.keys(config.value!.values)).toEqual(["fresh"]);
    });

    it("is opened when it leads elsewhere", async () => {
      const { invokeAction, onAction } = setup(() => "community_demo");
      invokeAction.mockResolvedValueOnce([
        entry({
          key: "auth_url",
          type: ConfigEntryType.URL,
          value: "https://example.com/auth",
        }),
      ]);

      await onAction("do_thing", {}, false);

      expect(click).toHaveBeenCalledOnce();
      expect(toastMock.warning).not.toHaveBeenCalled();
    });

    it("is opened from a built-in provider", async () => {
      apiMock.getProviderManifest.mockReturnValue({ tier: ProviderTier.CORE });
      const { invokeAction, onAction } = setup(() => "fastmcp_server");
      invokeAction.mockResolvedValueOnce([
        entry({ key: "page", type: ConfigEntryType.URL, value: ownUrl() }),
      ]);

      await onAction("do_thing", {}, false);

      expect(click).toHaveBeenCalledOnce();
    });
  });

  it("leaves reporting a failed action to the api and clears loading", async () => {
    const { loading, invokeAction, onAction } = setup();
    invokeAction.mockRejectedValueOnce(new Error("action failed"));

    await onAction("do_thing", {}, false);

    expect(toastMock.error).not.toHaveBeenCalled();
    expect(loading.value).toBe(false);
  });

  it("holds loading while the action is in flight", async () => {
    const { loading, invokeAction, onAction } = setup();
    let release: (entries: ConfigEntry[]) => void;
    invokeAction.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const pending = onAction("do_thing", {}, false);
    expect(loading.value).toBe(true);

    release!([]);
    await pending;
    expect(loading.value).toBe(false);
  });

  it("clears loading when the immediate_apply save fails", async () => {
    const { loading, invokeAction, saveValues, onAction } = setup();
    invokeAction.mockResolvedValueOnce([entry({ key: "fresh", value: "new" })]);
    saveValues.mockRejectedValueOnce(new Error("save failed"));

    await onAction("do_thing", {}, true);

    expect(toastMock.error).not.toHaveBeenCalled();
    expect(loading.value).toBe(false);
  });
});

function setup(answeredBy?: (action: string) => string | undefined) {
  const config = ref<{ values: Record<string, ConfigEntry> }>({
    values: { existing: entry() },
  });
  const loading = ref(false);
  const invokeAction =
    vi.fn<(action: string) => Promise<ConfigEntry[] | ConfigActionResult>>();
  const saveValues =
    vi.fn<
      (
        values: Record<string, ConfigValueType>,
      ) => Promise<{ values: Record<string, ConfigEntry> }>
    >();

  const { onAction } = useConfigAction({
    config,
    loading,
    invokeAction,
    saveValues,
    answeredBy,
  });

  return { config, loading, invokeAction, saveValues, onAction };
}

function entry(overrides: Partial<ConfigEntry> = {}): ConfigEntry {
  return {
    category: "generic",
    default_value: null,
    key: "existing",
    label: "Existing",
    options: [],
    required: false,
    type: ConfigEntryType.STRING,
    value: "current",
    ...overrides,
  };
}
