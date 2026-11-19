import AudioAnalysisCoverage from "@/components/AudioAnalysisCoverage.vue";
import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import AudioAnalysis from "@/views/settings/AudioAnalysis.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

enableAutoUnmount(afterEach);

// the parts of the page, by the component each one is
const PARTS = [
  ["status", AudioAnalysisCoverage],
  ["failures", AudioAnalysisFailures],
  ["modules", ProviderList],
  ["settings", SettingsPageForm],
] as const;

function mountPage() {
  return shallowMount(AudioAnalysis, {
    global: { mocks: { $t: (key: string) => key } },
  });
}

// the parts the page shows, in the order it shows them
function shownParts(wrapper: ReturnType<typeof mountPage>) {
  const elements = PARTS.flatMap(([name, part]) =>
    wrapper
      .findAllComponents(part)
      .map((found) => ({ name, element: found.element })),
  );
  return elements
    .sort((a, b) =>
      a.element.compareDocumentPosition(b.element) &
      Node.DOCUMENT_POSITION_FOLLOWING
        ? -1
        : 1,
    )
    .map(({ name }) => name);
}

describe("AudioAnalysis", () => {
  it("heads the page with the header of the audio analysis", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = mountPage();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "audio_analysis",
    );
  });

  it("shows an admin the status, the failed tracks, the analysis modules and the settings, in that order", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = mountPage();

    expect(shownParts(wrapper)).toEqual([
      "status",
      "failures",
      "modules",
      "settings",
    ]);
    expect(wrapper.getComponent(SettingsPageForm).props("page")).toBe(
      "audio_analysis",
    );
  });

  it("names the list of the audio analysis providers the analysis modules", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const list = mountPage().getComponent(ProviderList);

    expect(list.props()).toMatchObject({
      type: ProviderType.AUDIO_ANALYSIS,
      title: "settings.audio_analysis_modules",
    });
  });

  it("shows only the analysis modules to a role that may not manage the server", () => {
    hasScope.mockImplementation((scope) => scope !== Scope.SYSTEM_MANAGE);

    expect(shownParts(mountPage())).toEqual(["modules"]);
  });
});
