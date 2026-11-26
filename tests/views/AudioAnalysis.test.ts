import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
import AudioAnalysisModuleProgress from "@/components/AudioAnalysisModuleProgress.vue";
import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import SettingsPageFoldRow from "@/components/settings/SettingsPageFoldRow.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import AudioAnalysis from "@/views/settings/AudioAnalysis.vue";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../fixtures/providerConfig";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, hasScope } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    sendCommand: vi.fn(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.providers = reactive({});
  return { api: apiMock, default: apiMock };
});
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  listed = [];
  for (const key of Object.keys(apiMock.providers)) {
    delete apiMock.providers[key];
  }
});

interface Coverage {
  analyzed: number;
  pending: number;
  stale_version: number;
  analysis_version: number;
}

// the analysis modules the list shows
let listed: string[] = [];

// the list of the modules, with what the page shows under each one
const ModuleListStub = {
  name: "ProviderList",
  props: ["type", "title"],
  setup: () => ({
    configs: listed.map((domain) =>
      providerConfig({ domain, instance_id: `${domain}--1` }),
    ),
  }),
  template: `<div>
    <div v-for="config in configs" :key="config.instance_id" :data-module="config.domain">
      <slot name="details" :config="config" />
    </div>
  </div>`,
};

// the parts of the page, by the component each one is
const PARTS = [
  ["failures", AudioAnalysisFailures],
  ["settings", SettingsPageFoldRow],
  ["modules", ProviderList],
] as const;

async function mountPage() {
  const wrapper = shallowMount(AudioAnalysis, {
    global: {
      mocks: { $t: (key: string) => key },
      renderStubDefaultSlot: true,
      stubs: { ProviderList: ModuleListStub },
    },
  });
  await flushPromises();
  return wrapper;
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
  it("heads the page with the header of the audio analysis", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = await mountPage();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "audio_analysis",
    );
  });

  it("folds the failed tracks and the settings above the analysis modules for an admin", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = await mountPage();

    expect(shownParts(wrapper)).toEqual(["failures", "settings", "modules"]);
    expect(foldedParts(wrapper)).toEqual(["failures", "settings"]);
    // the card holds no other rows
    expect(
      wrapper.getComponent(SettingsFoldRows).element.childElementCount,
    ).toBe(2);
    expect(wrapper.getComponent(SettingsPageFoldRow).props()).toMatchObject({
      page: "audio_analysis",
      description: "settings.audio_analysis_settings_description",
    });
  });

  it("names the list of the audio analysis providers the analysis modules", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const list = (await mountPage()).getComponent(ProviderList);

    expect(list.props()).toMatchObject({
      type: ProviderType.AUDIO_ANALYSIS,
      title: "settings.audio_analysis_modules",
    });
  });

  it("shows only the settings and the analysis modules to a role that may not manage the server", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.SYSTEM_MANAGE);

    const wrapper = await mountPage();

    expect(shownParts(wrapper)).toEqual(["settings", "modules"]);
    expect(foldedParts(wrapper)).toEqual(["settings"]);
  });

  it("leaves out the card for a role that may neither manage the server nor change its settings", async () => {
    hasScope.mockImplementation(
      (scope) =>
        scope !== Scope.SYSTEM_MANAGE && scope !== Scope.CONFIG_CORE_WRITE,
    );

    const wrapper = await mountPage();

    expect(wrapper.findComponent(SettingsFoldRows).exists()).toBe(false);
    expect(shownParts(wrapper)).toEqual(["modules"]);
  });

  it("shows each analysis module how far its analysis has got", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    setModules({ loudness: true, smart_fades: true });
    answerCoverage({ loudness: coverage(0), smart_fades: coverage(40) });
    // a module that is set up but not loaded, so it has no coverage
    listed = ["loudness", "smart_fades", "sonic"];

    const wrapper = await mountPage();

    expect(progressByModule(wrapper)).toEqual({
      loudness: expect.objectContaining({
        instanceId: "loudness--1",
        available: true,
        pending: 0,
        coveragePct: 100,
      }),
      smart_fades: expect.objectContaining({
        instanceId: "smart_fades--1",
        available: true,
        pending: 40,
        coveragePct: 60,
      }),
      sonic: undefined,
    });
  });

  it("loads the coverage of each module once for the page", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    setModules({ loudness: true, smart_fades: true });
    answerCoverage({ loudness: coverage(0), smart_fades: coverage(40) });

    await mountPage();

    expect(apiMock.sendCommand.mock.calls).toEqual([
      ["audio_analysis/coverage", { aa_domain: "loudness" }],
      ["audio_analysis/coverage", { aa_domain: "smart_fades" }],
    ]);
  });

  it("follows a module that becomes available while the page is open", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    setModules({ loudness: false });
    answerCoverage({ loudness: coverage(5) });
    const wrapper = await mountPage();
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
    expect(progressByModule(wrapper).loudness).toMatchObject({
      available: false,
    });

    setModules({ loudness: true });
    await flushPromises();

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
    expect(progressByModule(wrapper).loudness).toMatchObject({
      available: true,
      pending: 5,
    });
  });

  it("shows no progress and loads none for a role that may not manage the server", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.SYSTEM_MANAGE);
    setModules({ loudness: true });
    answerCoverage({ loudness: coverage(5) });

    const wrapper = await mountPage();

    expect(wrapper.find('[data-module="loudness"]').exists()).toBe(true);
    expect(wrapper.findComponent(AudioAnalysisModuleProgress).exists()).toBe(
      false,
    );
    expect(apiMock.sendCommand).not.toHaveBeenCalled();
  });
});

// the analysis modules that are set up, by domain, and whether each is
// available; the list shows them all
function setModules(modules: Record<string, boolean>) {
  for (const [domain, available] of Object.entries(modules)) {
    apiMock.providers[`${domain}--1`] = {
      type: ProviderType.AUDIO_ANALYSIS,
      domain,
      name: domain,
      instance_id: `${domain}--1`,
      available,
    };
  }
  listed = Object.keys(modules);
}

// the coverage of a module with 60 tracks analyzed and the given number waiting
function coverage(pending: number): Coverage {
  return { analyzed: 60, pending, stale_version: 0, analysis_version: 1 };
}

function answerCoverage(byDomain: Record<string, Coverage>) {
  apiMock.sendCommand.mockImplementation(
    async (_command: string, args: { aa_domain: string }) =>
      byDomain[args.aa_domain],
  );
}

// the coverage the page hands the progress under each listed module
function progressByModule(wrapper: VueWrapper) {
  return Object.fromEntries(
    wrapper
      .findAll("[data-module]")
      .map((module) => [
        module.attributes("data-module"),
        module.findComponent(AudioAnalysisModuleProgress).props("coverage"),
      ]),
  );
}
