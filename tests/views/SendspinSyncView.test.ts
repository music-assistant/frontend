import {
  PROBE_CHECKS,
  type CheckStatus,
  type MicrophoneProbeReport,
  type ProbeVerdict,
} from "@/composables/sendspin-sync/useMicrophoneProbe";
import SendspinSyncView from "@/views/SendspinSyncView.vue";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
    mocks.report.value = degradedReport();
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
    // The device's own rate is worth seeing next to the context's.
    expect(wrapper.text()).toContain("44100 Hz");
    expect(wrapper.text()).toContain("-133.3 ppm");
    // A constraint the browser stayed silent on must not read as "off".
    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.values.not_reported",
    );
    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.verdict.degraded.title",
    );
  });

  it("copies the untranslated report as JSON", async () => {
    mocks.report.value = degradedReport();
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
    expect(JSON.parse(payload)).toEqual(degradedReport());
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "providers.sendspin_sync.probe.copied",
    );
  });

  it("explains an insecure origin instead of blaming the phone", async () => {
    mocks.report.value = {
      ...degradedReport(),
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

  it("separates a missing microphone from a refused one", async () => {
    const withError = (name: string): MicrophoneProbeReport => {
      const report = degradedReport();
      return {
        ...report,
        constraints: { ...report.constraints!, error: { name, message: "no" } },
      };
    };

    mocks.report.value = withError("NotAllowedError");
    const refused = mountView();
    await refused.vm.$nextTick();
    expect(refused.text()).toContain(
      "providers.sendspin_sync.probe.blocked.refused.title",
    );

    mocks.report.value = withError("NotFoundError");
    const missing = mountView();
    await missing.vm.$nextTick();
    expect(missing.text()).toContain(
      "providers.sendspin_sync.probe.blocked.no_device.title",
    );
    // The raw failure stays on the row, whichever branch was taken.
    expect(missing.text()).toContain("NotFoundError: no");
  });

  it("spells out a capture that heard nothing rather than leaving a bare zero", async () => {
    const report = degradedReport();
    mocks.report.value = {
      ...report,
      capture: { ...report.capture!, peakAmplitude: 0 },
    };
    const wrapper = mountView();
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.checks.capture.silent",
    );
    expect(wrapper.text()).toContain(
      "providers.sendspin_sync.probe.status.fail",
    );
  });
});

describe("SendspinSyncView fixture", () => {
  // The rendered numbers are only meaningful if they are numbers the worklet
  // and the composable could actually have produced together.
  it("describes a capture the worklet could really produce", () => {
    const capture = degradedReport().capture!;

    expect(capture.framesDelivered).toBe(capture.measuredQuanta * 128);
    expect(capture.renderSeconds).toBeCloseTo(
      capture.framesDelivered / SAMPLE_RATE,
      9,
    );
    expect(capture.discrepancyPpm).toBeCloseTo(
      ((capture.framesDelivered - capture.expectedFrames) /
        capture.expectedFrames) *
        1e6,
      9,
    );
  });
});

describe("SendspinSyncView translation keys", () => {
  // Keys are composed from check ids, statuses and verdict names, so a rename
  // would otherwise only surface as a missing string at runtime on a phone.
  const base = "providers.sendspin_sync.probe";
  const statuses: CheckStatus[] = ["pass", "warn", "fail", "not_evaluated"];
  const verdicts: ProbeVerdict[] = [
    "ready",
    "degraded",
    "unsupported",
    "blocked",
  ];
  const composed = [
    `${base}.idle.title`,
    `${base}.idle.description`,
    ...PROBE_CHECKS.flatMap((id) => [
      `${base}.checks.${id}.title`,
      `${base}.checks.${id}.hint`,
    ]),
    ...statuses.map((status) => `${base}.status.${status}`),
    ...verdicts.flatMap((verdict) => [
      `${base}.verdict.${verdict}.title`,
      `${base}.verdict.${verdict}.description`,
    ]),
    `${base}.checks.capture.silent`,
    ...[
      "insecure",
      "no_api",
      "refused",
      "no_device",
      "no_audio_pipeline",
    ].flatMap((reason) => [
      `${base}.blocked.${reason}.title`,
      `${base}.blocked.${reason}.description`,
    ]),
    ...[
      "yes",
      "no",
      "on",
      "off",
      "available",
      "unavailable",
      "not_reported",
      "stayed_running",
    ].map((value) => `${base}.values.${value}`),
  ];

  // Read from disk rather than imported: the i18n plugin precompiles anything
  // under src/translations, so an import hands back message functions.
  const en: unknown = JSON.parse(
    readFileSync(resolve(process.cwd(), "src/translations/en.json"), "utf8"),
  );

  it.each(composed)("resolves %s in en.json", (key) => {
    const message = key
      .split(".")
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === "object"
            ? (node as Record<string, unknown>)[part]
            : undefined,
        en,
      );

    expect(typeof message).toBe("string");
  });
});

/** A run that measured everything but never heard back on autoGainControl. */
function degradedReport(): MicrophoneProbeReport {
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
      honored: false,
      trackSettings: { sampleRate: 44100 },
      trackLabel: "Fake microphone",
      error: null,
    },
    audioContext: {
      sampleRate: SAMPLE_RATE,
      baseLatency: 0.005,
      outputLatency: 0.02,
    },
    // 7499 quanta of 128 frames is 19.99733 s of audio where the system clock
    // expected 20, so the pipeline ran 133 ppm slow.
    capture: {
      requestedSeconds: 30,
      measuredSeconds: 20,
      renderSeconds: (7499 * 128) / SAMPLE_RATE,
      measuredQuanta: 7499,
      framesDelivered: 7499 * 128,
      expectedFrames: SAMPLE_RATE * 20,
      discrepancyPpm: -133.33333333333334,
      totalQuanta: 11250,
      leadInQuanta: 9,
      droppedQuanta: 0,
      unconnectedQuanta: 0,
      peakAmplitude: 0.1875,
      started: true,
      aborted: false,
      error: null,
    },
    wakeLock: { supported: true, acquired: true, heldToEnd: true, error: null },
    contextState: { stayedRunning: true, transitions: [] },
  };
}
