import AudioAnalysisModuleProgress from "@/components/AudioAnalysisModuleProgress.vue";
import type { ProviderCoverageRow } from "@/composables/audio-analysis/useAudioAnalysisCoverage";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

// a plural key names its count, so the test reads which form was asked for
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, count?: unknown) =>
    typeof count === "number" ? `${key}:${count}` : key,
}));

enableAutoUnmount(afterEach);

const PROGRESS = '[data-testid="aa-module-progress"]';

describe("AudioAnalysisModuleProgress", () => {
  it("shows how far a module with tracks waiting has got", () => {
    const wrapper = mountProgress(coverage({ analyzed: 80, pending: 20 }));

    expect(wrapper.get('[role="progressbar"]').attributes()).toMatchObject({
      "aria-valuenow": "80",
    });
    expect(wrapper.get('[data-testid="aa-module-progress-pct"]').text()).toBe(
      "80%",
    );
    const state = wrapper.get('[data-testid="aa-module-progress-state"]');
    expect(state.text()).toBe("settings.audio_analysis_coverage.waiting:20");
    expect(state.classes()).toContain("text-muted-foreground");
  });

  it("says a module with nothing waiting is up to date", () => {
    const wrapper = mountProgress(coverage({ analyzed: 100, pending: 0 }));

    expect(wrapper.get('[data-testid="aa-module-progress-pct"]').text()).toBe(
      "100%",
    );
    expect(wrapper.get('[data-testid="aa-module-progress-state"]').text()).toBe(
      "settings.audio_analysis_coverage.up_to_date",
    );
  });

  it("shows nothing for a module that is not available", () => {
    const wrapper = mountProgress({
      ...coverage({ analyzed: 80, pending: 20 }),
      available: false,
      hasData: false,
    });

    expect(wrapper.find(PROGRESS).exists()).toBe(false);
  });

  it("shows nothing for a module without tracks to analyze", () => {
    const wrapper = mountProgress(coverage({ analyzed: 0, pending: 0 }));

    expect(wrapper.find(PROGRESS).exists()).toBe(false);
  });

  it("shows nothing while the coverage of the module is not known", () => {
    const wrapper = mountProgress(undefined);

    expect(wrapper.find(PROGRESS).exists()).toBe(false);
  });
});

// the coverage of an available module, as the coverage composable gives it
function coverage({
  analyzed,
  pending,
}: {
  analyzed: number;
  pending: number;
}): ProviderCoverageRow {
  const total = analyzed + pending;
  return {
    domain: "loudness_analysis",
    name: "Loudness",
    instanceId: "loudness_analysis--1",
    available: true,
    analyzed,
    pending,
    staleVersion: 0,
    analysisVersion: 1,
    coveragePct: total > 0 ? Math.floor((analyzed / total) * 100) : 0,
    hasData: total > 0,
  };
}

function mountProgress(row: ProviderCoverageRow | undefined) {
  return mount(AudioAnalysisModuleProgress, { props: { coverage: row } });
}
