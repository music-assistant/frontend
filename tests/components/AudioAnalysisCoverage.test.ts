import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import type { ProviderCoverageRow } from "@/composables/useAudioAnalysisCoverage";

const { mockRefresh } = vi.hoisted(() => ({
  mockRefresh: vi.fn().mockResolvedValue(undefined),
}));

const mockRows = ref<ProviderCoverageRow[]>([]);

vi.mock("@/composables/useAudioAnalysisCoverage", () => ({
  useAudioAnalysisCoverage: () => ({
    rows: mockRows,
    loading: ref(false),
    refresh: mockRefresh,
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
      },
    ];
    const w = mount(AudioAnalysisCoverage);
    expect(w.find("[data-test='aa-coverage']").exists()).toBe(true);
    expect(w.findAll("[data-test='aa-row']")).toHaveLength(1);
    expect(w.text()).toContain("Sonic Analysis");
    expect(w.text()).toContain("78%");
  });
});
