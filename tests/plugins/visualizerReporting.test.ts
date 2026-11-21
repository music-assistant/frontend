/**
 * Capability reporting gates.
 *
 * The report goes out from cast receivers and TVs, so it has to stay silent on
 * a session that should not report at all, stay out of the global error toast
 * (a display with nobody in front of it cannot dismiss one), and go out once.
 */
import type { reportVisualizerCapability } from "@/plugins/visualizer-relay";
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
  baseUrl: "http://ma.local:8095",
  providers: {},
  isRemoteConnection: { value: false },
}));
vi.mock("@/plugins/api", () => ({ default: apiMock }));

const authMock = vi.hoisted(() => ({ isDashboardViewer: vi.fn(() => true) }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));

vi.mock("@/plugins/router", () => ({
  default: {
    currentRoute: { value: { path: "/party", query: { dashboard_id: "d1" } } },
  },
}));

vi.mock("@/plugins/store", () => ({ store: { isIngressSession: true } }));

vi.mock("@/composables/visualizer/useVisualizerEngine", () => ({
  isVisualizerSupported: () => true,
}));

// The report is once per page load, so each test needs a fresh module.
const freshReporter = async () => {
  vi.resetModules();
  return (await import("@/plugins/visualizer-relay"))
    .reportVisualizerCapability as typeof reportVisualizerCapability;
};

describe("visualizer capability reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.isDashboardViewer.mockReturnValue(true);
  });

  it("sends the capability fields and keeps out of the global error toast", async () => {
    const report = await freshReporter();
    await report("butterchurn", "stub gpu");

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    const [command, args, options] = apiMock.sendCommand.mock.calls[0];
    expect(command).toBe("milkdrop_visualizer/report_capability");
    expect(args).toMatchObject({
      webgl2: true,
      renderer: "butterchurn",
      gpu: "stub gpu",
      dashboard_id: "d1",
    });
    expect(options).toEqual({ suppressGlobalError: true });
  });

  it("reports only once per page load", async () => {
    const report = await freshReporter();
    await report("butterchurn");
    await report("none", undefined, "engine failed");

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("says nothing on a session that is not a dashboard viewer", async () => {
    authMock.isDashboardViewer.mockReturnValue(false);
    const report = await freshReporter();

    await report("butterchurn");

    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });

  it("swallows a failed report rather than rejecting into the caller", async () => {
    apiMock.sendCommand.mockRejectedValueOnce(new Error("plugin exploded"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const report = await freshReporter();

    try {
      await expect(report("butterchurn")).resolves.toBeUndefined();
    } finally {
      warn.mockRestore();
    }
  });
});
