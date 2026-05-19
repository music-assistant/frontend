import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { TaskStatus } from "@/plugins/api/interfaces";
import type {
  ProviderCoverageRow,
  ScanStatus,
} from "@/composables/useAudioAnalysisCoverage";

// vi.hoisted runs before module bindings — use the raw string value of TaskStatus.IDLE here;
// the `as ScanStatus` cast below enforces type safety at the call-site level.
const { mockRefresh, mockStartAutoRefresh, mockStopAutoRefresh } = vi.hoisted(
  () => ({
    mockRefresh: vi.fn().mockResolvedValue(undefined),
    mockStartAutoRefresh: vi.fn(),
    mockStopAutoRefresh: vi.fn(),
  }),
);

// Reactive refs — must be created outside vi.hoisted (hoisted callbacks run before imports).
const mockRows = ref<ProviderCoverageRow[]>([]);
const mockScan = ref<ScanStatus>({
  status: TaskStatus.IDLE,
  failureCount: 0,
  unavailable: false,
});

vi.mock("@/composables/useAudioAnalysisCoverage", () => ({
  useAudioAnalysisCoverage: () => ({
    rows: mockRows,
    scan: mockScan,
    loading: ref(false),
    refresh: mockRefresh,
    startAutoRefresh: mockStartAutoRefresh,
    stopAutoRefresh: mockStopAutoRefresh,
  }),
}));
vi.mock("@/plugins/i18n", () => ({ $t: (k: string) => k }));
vi.mock("@/plugins/api", () => ({ api: { providers: {} } }));

import AudioAnalysisCoverage from "@/components/AudioAnalysisCoverage.vue";

describe("AudioAnalysisCoverage.vue", () => {
  beforeEach(() => {
    mockRows.value = [];
  });

  it("renders nothing when there are no AA provider rows", () => {
    const w = mount(AudioAnalysisCoverage);
    expect(w.find("[data-test='aa-coverage']").exists()).toBe(false);
  });

  it("renders one row per provider when rows present", () => {
    mockRows.value = [
      {
        domain: "sonic_analysis",
        name: "Sonic Analysis",
        instanceId: "sa1",
        available: true,
        analyzed: 78,
        pending: 22,
        staleVersion: 3,
        analysisVersion: 2,
        coveragePct: 78,
        hasData: true,
        error: false,
      },
    ];
    const w = mount(AudioAnalysisCoverage);
    expect(w.find("[data-test='aa-coverage']").exists()).toBe(true);
    expect(w.findAll("[data-test='aa-row']")).toHaveLength(1);
    expect(w.text()).toContain("Sonic Analysis");
    expect(w.text()).toContain("78%");
  });
});
