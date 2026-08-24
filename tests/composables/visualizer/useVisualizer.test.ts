/**
 * Tests for the visualizer's per-player preferences and their defaults, plus
 * the enabled-state fallback: a session with no stored preference (a cast
 * dashboard viewer has none and cannot set any) follows the plugin's
 * show_on_dashboards setting, while an explicit preference always wins.
 * Dashboard viewers that cannot render also report their (negative)
 * capability, since nothing else on such a display would.
 */
import {
  useVisualizer,
  visualizerEnabledForPlayer,
} from "@/composables/visualizer/useVisualizer";
import {
  VISUALIZER_BLUR_DEFAULT,
  VISUALIZER_OPACITY_DEFAULT,
} from "@/composables/visualizer/state";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const relayMocks = vi.hoisted(() => ({
  reportVisualizerCapability: vi.fn(async () => {}),
  visualizerCanRender: vi.fn(() => true),
  visualizerProviderAvailable: vi.fn(() => true),
  visualizerShownOnDashboards: vi.fn(async () => true),
}));
vi.mock("@/plugins/visualizer-relay", () => relayMocks);

const authMocks = vi.hoisted(() => ({
  authManager: { isDashboardViewer: vi.fn(() => false) },
}));
vi.mock("@/plugins/auth", () => authMocks);

const storeMock = vi.hoisted(() => ({
  store: { currentUser: { preferences: {} as Record<string, unknown> } },
}));
vi.mock("@/plugins/store", () => storeMock);

vi.mock("@/composables/userPreferences", () => ({
  setUserPreference: vi.fn(),
  useUserPreferences: () => ({
    getPreference: (_key: string, fallback: unknown) => ref(fallback),
  }),
}));

const apiMocks = vi.hoisted(() => ({
  sendCommand: vi.fn(async (): Promise<Record<string, unknown>> => ({})),
  subscribe: vi.fn((_event: string, _callback: () => void) => () => {}),
  supportsDashboardVisualizer: true,
}));
vi.mock("@/plugins/api", () => ({ default: apiMocks }));

vi.mock("@/plugins/router", async () => {
  // Imported inside the factory: the hoisted mock runs before this module's
  // own vue import binding is initialized.
  const { ref } = await import("vue");
  return {
    default: {
      currentRoute: ref({
        path: "/party",
        query: {} as Record<string, string>,
      }),
    },
  };
});

// The module keeps singleton watch state; a fresh import per test keeps the
// tests order-independent.
async function importComposable() {
  vi.resetModules();
  return await import("@/composables/visualizer/useVisualizer");
}

describe("visualizerEnabledForPlayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.store.currentUser = { preferences: {} };
  });

  it("honours the preference, with the per-player one winning", () => {
    storeMock.store.currentUser.preferences["visualizer_enabled"] = true;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(true);
    storeMock.store.currentUser.preferences["visualizer_enabled.kitchen"] =
      false;
    expect(visualizerEnabledForPlayer("kitchen")).toBe(false);
  });
});

describe("blur and opacity defaults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The same two numbers used to sit hardcoded in four places; these assertions
  // are what stops them drifting apart again.
  it("falls back to the shared constants when nothing is stored", () => {
    const { visualizerBlurPref, visualizerOpacityPref } =
      useVisualizer("kitchen");
    expect(visualizerBlurPref.value).toBe(VISUALIZER_BLUR_DEFAULT);
    expect(visualizerOpacityPref.value).toBe(VISUALIZER_OPACITY_DEFAULT);
  });

  it("starts unblurred at 40%, on a step the slider can land on", () => {
    expect(VISUALIZER_BLUR_DEFAULT).toBe(0);
    expect(VISUALIZER_OPACITY_DEFAULT).toBe(40);
    // the opacity slider runs 10..100 in steps of 5
    expect(VISUALIZER_OPACITY_DEFAULT % 5).toBe(0);
  });
});

describe("visualizer dashboard default", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.store.currentUser = { preferences: {} };
    authMocks.authManager.isDashboardViewer.mockReturnValue(false);
    relayMocks.visualizerShownOnDashboards.mockResolvedValue(true);
  });

  it("follows the plugin setting when no preference is stored", async () => {
    const { useVisualizer, visualizerEnabledForPlayer } =
      await importComposable();
    // Hosting a view starts the module-level watch that fetches the setting.
    const { visualizerEnabledPref } = useVisualizer();
    await flushPromises();
    expect(relayMocks.visualizerShownOnDashboards).toHaveBeenCalled();
    expect(visualizerEnabledPref.value).toBe(true);
    expect(visualizerEnabledForPlayer()).toBe(true);
  });

  it("lets an explicit global preference override the plugin setting", async () => {
    const { useVisualizer, visualizerEnabledForPlayer } =
      await importComposable();
    const { visualizerEnabledPref } = useVisualizer();
    await flushPromises();
    storeMock.store.currentUser.preferences["visualizer_enabled"] = false;
    expect(visualizerEnabledPref.value).toBe(false);
    expect(visualizerEnabledForPlayer()).toBe(false);
  });

  it("lets a per-player preference override everything", async () => {
    const { useVisualizer, visualizerEnabledForPlayer } =
      await importComposable();
    useVisualizer();
    await flushPromises();
    storeMock.store.currentUser.preferences["visualizer_enabled"] = true;
    storeMock.store.currentUser.preferences["visualizer_enabled.p1"] = false;
    expect(visualizerEnabledForPlayer("p1")).toBe(false);
    expect(visualizerEnabledForPlayer("p2")).toBe(true);
  });

  it("reports a negative capability for dashboard viewers without WebGL2", async () => {
    authMocks.authManager.isDashboardViewer.mockReturnValue(true);
    // jsdom has no WebGL2, so isVisualizerSupported() is genuinely false here,
    // matching the display this path exists for.
    const { useVisualizer } = await importComposable();
    useVisualizer();
    await flushPromises();
    expect(relayMocks.reportVisualizerCapability).toHaveBeenCalledWith("none");
  });

  it("does not report capability for regular sessions", async () => {
    const { useVisualizer } = await importComposable();
    useVisualizer();
    await flushPromises();
    expect(relayMocks.reportVisualizerCapability).not.toHaveBeenCalled();
  });
});

describe("viewer preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.store.currentUser = { preferences: {} };
    authMocks.authManager.isDashboardViewer.mockReturnValue(true);
    relayMocks.visualizerShownOnDashboards.mockResolvedValue(false);
    apiMocks.sendCommand.mockResolvedValue({});
    apiMocks.supportsDashboardVisualizer = true;
  });

  it("renders with the casting user's preferences", async () => {
    apiMocks.sendCommand.mockResolvedValue({
      visualizer_preset: "martin - mandelbox explorer",
      visualizer_opacity: 55,
    });
    const { useVisualizer } = await importComposable();
    // the launched url carries the display's dashboard id in the route query
    const router = (await import("@/plugins/router")).default;
    router.currentRoute.value.query.dashboard_id = "chromecast_abc";
    const { visualizerPresetPref, visualizerOpacityPref } = useVisualizer();
    await flushPromises();

    expect(apiMocks.sendCommand).toHaveBeenCalledWith(
      "dashboard/viewer_preferences",
      {
        dashboard: "party",
        player_id: undefined,
        dashboard_id: "chromecast_abc",
      },
    );
    expect(visualizerPresetPref.value).toBe("martin - mandelbox explorer");
    expect(visualizerOpacityPref.value).toBe(55);
  });

  it("skips the fetch on servers without the command", async () => {
    apiMocks.supportsDashboardVisualizer = false;
    const { useVisualizer } = await importComposable();
    useVisualizer();
    await flushPromises();

    expect(apiMocks.sendCommand).not.toHaveBeenCalledWith(
      "dashboard/viewer_preferences",
      expect.anything(),
    );
  });

  it("ignores the owner's global toggle but honors their per-player override", async () => {
    // The owner turned the visualizer off on their own screens; the display
    // they deliberately cast to follows show_on_dashboards instead.
    apiMocks.sendCommand.mockResolvedValue({
      visualizer_enabled: false,
      "visualizer_enabled.p2": false,
    });
    relayMocks.visualizerShownOnDashboards.mockResolvedValue(true);
    const { useVisualizer, visualizerEnabledForPlayer } =
      await importComposable();
    useVisualizer();
    await flushPromises();

    expect(visualizerEnabledForPlayer("p1")).toBe(true);
    // an explicit per-player choice for the shown player still wins
    expect(visualizerEnabledForPlayer("p2")).toBe(false);
  });

  it("refreshes when the dashboard sessions update", async () => {
    const { useVisualizer } = await importComposable();
    const { visualizerPresetPref } = useVisualizer();
    await flushPromises();
    expect(visualizerPresetPref.value).toBe("");

    // the server signals sessions-updated when the owner's preferences change
    const sessionsUpdatedHandler = apiMocks.subscribe.mock.calls[0][1];
    apiMocks.sendCommand.mockResolvedValue({ visualizer_preset: "new pick" });
    sessionsUpdatedHandler();
    await flushPromises();
    expect(visualizerPresetPref.value).toBe("new pick");
  });

  it("falls back to the plugin default when no session owner is known", async () => {
    apiMocks.sendCommand.mockResolvedValue({});
    relayMocks.visualizerShownOnDashboards.mockResolvedValue(true);
    const { useVisualizer, visualizerEnabledForPlayer } =
      await importComposable();
    useVisualizer();
    await flushPromises();
    expect(visualizerEnabledForPlayer()).toBe(true);
  });
});
