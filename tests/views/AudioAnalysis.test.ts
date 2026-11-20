import AudioAnalysisCoverage from "@/components/AudioAnalysisCoverage.vue";
import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import SettingsPageFoldRow from "@/components/settings/SettingsPageFoldRow.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import AudioAnalysis from "@/views/settings/AudioAnalysis.vue";
import {
  enableAutoUnmount,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

enableAutoUnmount(afterEach);

// the parts of the page, by the component each one is
const PARTS = [
  ["progress", AudioAnalysisCoverage],
  ["failures", AudioAnalysisFailures],
  ["settings", SettingsPageFoldRow],
  ["modules", ProviderList],
] as const;

function mountPage() {
  return shallowMount(AudioAnalysis, {
    global: {
      mocks: { $t: (key: string) => key },
      renderStubDefaultSlot: true,
    },
  });
}

// the parts within a wrapper, in the order the page shows them
function shownParts(wrapper: VueWrapper) {
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

// the parts the card at the top of the page holds
function foldedParts(wrapper: VueWrapper) {
  const card = wrapper.findComponent(SettingsFoldRows);
  return card.exists() ? shownParts(card) : [];
}

describe("AudioAnalysis", () => {
  it("heads the page with the header of the audio analysis", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = mountPage();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "audio_analysis",
    );
  });

  it("folds the progress, the failed tracks and the settings above the analysis modules for an admin", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = mountPage();

    expect(shownParts(wrapper)).toEqual([
      "progress",
      "failures",
      "settings",
      "modules",
    ]);
    expect(foldedParts(wrapper)).toEqual(["progress", "failures", "settings"]);
    expect(wrapper.getComponent(SettingsPageFoldRow).props()).toMatchObject({
      page: "audio_analysis",
      description: "settings.audio_analysis_settings_description",
    });
  });

  it("names the list of the audio analysis providers the analysis modules", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const list = mountPage().getComponent(ProviderList);

    expect(list.props()).toMatchObject({
      type: ProviderType.AUDIO_ANALYSIS,
      title: "settings.audio_analysis_modules",
    });
  });

  it("shows only the settings and the analysis modules to a role that may not manage the server", () => {
    hasScope.mockImplementation((scope) => scope !== Scope.SYSTEM_MANAGE);

    const wrapper = mountPage();

    expect(shownParts(wrapper)).toEqual(["settings", "modules"]);
    expect(foldedParts(wrapper)).toEqual(["settings"]);
  });

  it("leaves out the card for a role that may neither manage the server nor change its settings", () => {
    hasScope.mockImplementation(
      (scope) =>
        scope !== Scope.SYSTEM_MANAGE && scope !== Scope.CONFIG_CORE_WRITE,
    );

    const wrapper = mountPage();

    expect(wrapper.findComponent(SettingsFoldRows).exists()).toBe(false);
    expect(shownParts(wrapper)).toEqual(["modules"]);
  });
});
