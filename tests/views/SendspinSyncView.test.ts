import type { MicrophoneProbeReport } from "@/composables/sendspin-sync/useMicrophoneProbe";
import SendspinSyncView from "@/views/SendspinSyncView.vue";
import { mount } from "@vue/test-utils";
import type { Ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SAMPLE_RATE = 48000;

const mocks = vi.hoisted(() => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  // The composable mock builds the refs, so the view and the test share them.
  running: undefined as unknown as Ref<boolean>,
  report: undefined as unknown as Ref<MicrophoneProbeReport | null>,
}));

vi.mock("@/composables/sendspin-sync/useMicrophoneProbe", async () => {
  const actual = await vi.importActual<
    typeof import("@/composables/sendspin-sync/useMicrophoneProbe")
  >("@/composables/sendspin-sync/useMicrophoneProbe");
  const { computed, ref } = await vi.importActual<typeof import("vue")>("vue");
  mocks.running = ref(false);
  mocks.report = ref<MicrophoneProbeReport | null>(null);
  const stub = {
    running: mocks.running,
    report: mocks.report,
    reportJson: computed(() =>
      mocks.report.value ? JSON.stringify(mocks.report.value, null, 2) : "",
    ),
    captureProgress: ref(0),
    captureRemainingSeconds: ref(30),
    run: vi.fn(),
  };
  return { ...actual, useMicrophoneProbe: () => stub };
});

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: mocks.copyToClipboard,
}));

vi.mock("vue-sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

beforeEach(() => {
  mocks.copyToClipboard.mockClear();
  mocks.toastSuccess.mockClear();
  mocks.toastError.mockClear();
  mocks.running.value = false;
  mocks.report.value = null;
});

function mountView() {
  return mount(SendspinSyncView, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("SendspinSyncView", () => {
  it("offers the check without claiming a result yet", () => {
    const wrapper = mountView();

    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.idle.title",
    );
    expect(wrapper.text()).toContain("providers.sendspin_sync.probe.start");
    expect(wrapper.findAll("li")).toHaveLength(0);
  });

  it("shows every check with its reading once a report lands", async () => {
    mocks.report.value = readyReport();
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    const rows = wrapper.findAll("li");
    expect(rows).toHaveLength(7);
    expect(rows[0].text()).toContain(
      "providers.sendspin_sync.probe.checks.secure_context.title",
    );
    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.status.pass",
    );
    expect(wrapper.text()).toContain(`${SAMPLE_RATE} Hz`);
    expect(wrapper.text()).toContain("5.00 ms");
    expect(wrapper.text()).toContain("-12.0 ppm");
    // A constraint the browser stayed silent on must not read as "off".
    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.values.not_reported",
    );
    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.verdict.degraded.title",
    );
  });

  it("copies the untranslated report as JSON", async () => {
    mocks.report.value = readyReport();
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    const copyButton = wrapper
      .findAll("button")
      .find((button) =>
        button.text().includes("providers.sendspin_sync.probe.copy"),
      );
    await copyButton!.trigger("click");
    await wrapper.vm.$nextTick();

    const [payload] = mocks.copyToClipboard.mock.calls[0];
    expect(JSON.parse(payload)).toEqual(readyReport());
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "providers.sendspin_sync.probe.copied",
    );
  });

  it("explains an insecure origin instead of blaming the phone", async () => {
    mocks.report.value = {
      ...readyReport(),
      secureContext: {
        secure: false,
        origin: "http://ma.local:8095",
        protocol: "http:",
      },
      mediaApi: { mediaDevices: false, getUserMedia: false },
      constraints: null,
      audioContext: null,
      capture: null,
      wakeLock: null,
      contextState: null,
    };
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.blocked.insecure.title",
    );
    expect(wrapper.text()).toContain("http://ma.local:8095");
    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.status.not_evaluated",
    );
  });
});

/** A run that measured everything but never heard back on autoGainControl. */
function readyReport(): MicrophoneProbeReport {
  return {
    version: 1,
    startedAt: "2026-01-01T00:00:00.000Z",
    userAgent: "test",
    secureContext: {
      secure: true,
      origin: "https://ma.local",
      protocol: "https:",
    },
    mediaApi: { mediaDevices: true, getUserMedia: true },
    constraints: {
      requested: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      applied: { echoCancellation: false, noiseSuppression: false },
      supported: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      honoured: false,
      trackSettings: {},
      trackLabel: "Fake microphone",
      error: null,
    },
    audioContext: {
      sampleRate: SAMPLE_RATE,
      baseLatency: 0.005,
      outputLatency: 0.02,
    },
    capture: {
      requestedSeconds: 30,
      measuredSeconds: 30,
      framesDelivered: 1439982,
      expectedFrames: 1440000,
      discrepancyPpm: -12,
      quanta: 11250,
      gapCount: 0,
      missingFrames: 0,
      error: null,
    },
    wakeLock: { supported: true, acquired: true, error: null },
    contextState: { stayedRunning: true, transitions: [] },
  };
}
