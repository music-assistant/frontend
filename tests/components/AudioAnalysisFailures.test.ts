import AudioAnalysisFailures from "@/components/AudioAnalysisFailures.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {},
    sendCommand: vi.fn(),
    getTrack: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

const ROW = '[data-testid="settings-fold-failures"]';
const STATE = '[data-testid="settings-fold-state"]';

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getTrack.mockRejectedValue(new Error("not found"));
});

describe("AudioAnalysisFailures", () => {
  it("shows no state while the failures load the first time", async () => {
    apiMock.sendCommand.mockReturnValue(new Promise(() => {}));

    const wrapper = await mountRow();

    expect(wrapper.find(ROW).exists()).toBe(true);
    expect(wrapper.find(STATE).exists()).toBe(false);
  });

  it("counts the failed tracks in the warning colour", async () => {
    apiMock.sendCommand.mockResolvedValue([failure("1"), failure("2")]);

    const wrapper = await mountRow();

    expect(wrapper.get(STATE).text()).toBe("2");
    expect(wrapper.get(STATE).classes()).toContain("text-warning");
  });

  it("says there are none, without a warning", async () => {
    apiMock.sendCommand.mockResolvedValue([]);

    const wrapper = await mountRow();

    expect(wrapper.get(STATE).text()).toBe(
      "settings.audio_analysis_failures.state_none",
    );
    expect(wrapper.get(STATE).classes()).toContain("text-muted-foreground");
  });

  it("shows no state when the failures could not be loaded", async () => {
    apiMock.sendCommand.mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = await mountRow();

    expect(wrapper.find(ROW).exists()).toBe(true);
    expect(wrapper.find(STATE).exists()).toBe(false);
    expect(wrapper.find('[data-test="aa-failures-error"]').exists()).toBe(true);
  });

  it("explains the failures above them, with a way to clear them all", async () => {
    apiMock.sendCommand.mockResolvedValue([failure("1")]);

    const wrapper = await mountRow();
    const row = wrapper.get(ROW);

    expect(row.text()).toContain(
      "settings.audio_analysis_failures.description",
    );
    expect(row.text()).toContain("settings.audio_analysis_failures.clear_all");
    expect(row.findAll('[data-test="aa-failure-row"]')).toHaveLength(1);
  });
});

function failure(itemId: string) {
  return {
    item_id: itemId,
    provider: "library",
    aa_provider_domain: "smart_fades",
    reason: "File not found",
    next_retry: null,
    timestamp_created: 0,
  };
}

async function mountRow() {
  const wrapper = mount(
    defineComponent({
      components: { AudioAnalysisFailures, SettingsFoldRows },
      template:
        "<SettingsFoldRows><AudioAnalysisFailures /></SettingsFoldRows>",
    }),
  );
  await flushPromises();
  return wrapper;
}
