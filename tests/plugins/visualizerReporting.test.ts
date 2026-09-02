/**
 * Capability reporting gates.
 *
 * These reports go out from cast receivers and TVs, so every one of them has to
 * stay silent on a session that should not report at all, on a server too old
 * to know the command, and in the global error toast: a display with nobody in
 * front of it cannot dismiss one, and the render report repeats every minute.
 */
import {
  reportVisualizerCapability,
  reportVisualizerRender,
} from "@/plugins/visualizer-relay";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  // typed so the assertions below can read the options argument off mock.calls
  sendCommand: vi.fn(
    async (
      _command: string,
      _args?: Record<string, unknown>,
      _options?: { suppressGlobalError?: boolean },
    ) => ({}),
  ),
  supportsDashboardVisualizer: true,
  baseUrl: "http://ma.local:8095",
  providers: {},
  isRemoteConnection: { value: false },
}));
vi.mock("@/plugins/api", () => ({ default: apiMock }));

const authMock = vi.hoisted(() => ({ isDashboardViewer: vi.fn(() => true) }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));

vi.mock("@/plugins/router", () => ({
  default: { currentRoute: { value: { path: "/party", query: {} } } },
}));

vi.mock("@/plugins/store", () => ({ store: { isIngressSession: true } }));

vi.mock("@/composables/visualizer/useVisualizerEngine", () => ({
  isVisualizerSupported: () => true,
}));

const sample = {
  fps: 30,
  targetFps: 30,
  lateRatio: 0,
  pixels: 1_000_000,
  renderMs: 5,
  blockedRatio: 0,
  preset: "some preset",
};

describe("visualizer capability reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.supportsDashboardVisualizer = true;
    authMock.isDashboardViewer.mockReturnValue(true);
  });

  it("keeps every report out of the global error toast", async () => {
    await reportVisualizerCapability("butterchurn", "stub gpu");
    await reportVisualizerRender(sample, 1, "settled");

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
    for (const call of apiMock.sendCommand.mock.calls) {
      expect(call[2]).toEqual({ suppressGlobalError: true });
    }
  });

  it("says nothing on a session that is not a dashboard viewer", async () => {
    authMock.isDashboardViewer.mockReturnValue(false);

    await reportVisualizerCapability("butterchurn");
    await reportVisualizerRender(sample, 1, "settled");

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("says nothing to a server without the command", async () => {
    apiMock.supportsDashboardVisualizer = false;

    await reportVisualizerCapability("butterchurn");
    await reportVisualizerRender(sample, 1, "settled");

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("swallows a failed report rather than rejecting into the caller", async () => {
    apiMock.sendCommand.mockRejectedValueOnce(new Error("plugin exploded"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      reportVisualizerCapability("butterchurn"),
    ).resolves.toBeUndefined();
  });
});
