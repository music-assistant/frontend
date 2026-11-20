import AudioAnalysisCoverage from "@/components/AudioAnalysisCoverage.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import { ProviderType } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    sendCommand: vi.fn(),
  },
}));

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.providers = reactive({});
  return { api: apiMock, default: apiMock };
});
// a plural key names its count, so the test reads which form was asked for
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, count?: unknown) =>
    typeof count === "number" ? `${key}:${count}` : key,
}));

enableAutoUnmount(afterEach);

interface Coverage {
  analyzed: number;
  pending: number;
  stale_version: number;
  analysis_version: number;
}

const ROW = '[data-testid="settings-fold-progress"]';
const STATE = '[data-testid="settings-fold-state"]';

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(apiMock.providers)) {
    delete apiMock.providers[key];
  }
});

describe("AudioAnalysisCoverage", () => {
  it("renders nothing while no analysis module is set up", async () => {
    setModules({});

    const wrapper = await mountRow();

    expect(wrapper.find(ROW).exists()).toBe(false);
  });

  it("shows the row without a state while the coverage loads", async () => {
    setModules({ smart_fades: true });
    apiMock.sendCommand.mockReturnValue(new Promise(() => {}));

    const wrapper = await mountRow();

    expect(wrapper.find(ROW).exists()).toBe(true);
    expect(wrapper.find(STATE).exists()).toBe(false);
  });

  it("says the analysis is up to date when no module has tracks waiting", async () => {
    setModules({ smart_fades: true, loudness: true });
    answerCoverage({ smart_fades: coverage(0), loudness: coverage(0) });

    const wrapper = await mountRow();

    expect(wrapper.get(STATE).text()).toBe(
      "settings.audio_analysis_coverage.up_to_date",
    );
  });

  it("counts the modules with tracks waiting, not the tracks", async () => {
    setModules({ smart_fades: true, loudness: true, sonic: true });
    answerCoverage({
      smart_fades: coverage(120),
      loudness: coverage(0),
      sonic: coverage(3),
    });

    const wrapper = await mountRow();

    expect(wrapper.get(STATE).text()).toBe(
      "settings.audio_analysis_coverage.modules_busy:2",
    );
    expect(wrapper.get(STATE).classes()).toContain("text-muted-foreground");
  });

  it("leaves a module that is not available out of the count", async () => {
    setModules({ smart_fades: true, loudness: false });
    answerCoverage({ smart_fades: coverage(0), loudness: coverage(50) });

    const wrapper = await mountRow();

    expect(wrapper.get(STATE).text()).toBe(
      "settings.audio_analysis_coverage.up_to_date",
    );
  });

  it("shows no state when no module is available", async () => {
    setModules({ smart_fades: false });

    const wrapper = await mountRow();

    expect(wrapper.find(ROW).exists()).toBe(true);
    expect(wrapper.find(STATE).exists()).toBe(false);
  });

  it("follows a module that is set up while the page is open", async () => {
    setModules({});
    const wrapper = await mountRow();

    answerCoverage({ smart_fades: coverage(4) });
    setModules({ smart_fades: true });
    await flushPromises();

    expect(wrapper.get(STATE).text()).toBe(
      "settings.audio_analysis_coverage.modules_busy:1",
    );
  });
});

// the analysis modules that are set up, by domain, and whether each is available
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
}

function coverage(pending: number): Coverage {
  return { analyzed: 100, pending, stale_version: 0, analysis_version: 1 };
}

function answerCoverage(byDomain: Record<string, Coverage>) {
  apiMock.sendCommand.mockImplementation(
    async (_command: string, args: { aa_domain: string }) =>
      byDomain[args.aa_domain],
  );
}

async function mountRow() {
  const wrapper = mount(
    defineComponent({
      components: { AudioAnalysisCoverage, SettingsFoldRows },
      template:
        "<SettingsFoldRows><AudioAnalysisCoverage /></SettingsFoldRows>",
    }),
  );
  await flushPromises();
  return wrapper;
}
