import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import SettingsPageFoldRow from "@/components/settings/SettingsPageFoldRow.vue";
import { Scope } from "@/plugins/api/interfaces";
import { Settings2 } from "@lucide/vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

// the form is covered where it lives; here it only has to be held and reset
const settingsPageFormStub = {
  name: "SettingsPageForm",
  props: { page: String, flat: Boolean },
  emits: ["reset"],
  template: "<div data-testid='page-form' />",
};

const ROW = '[data-testid="settings-fold-settings"]';

beforeEach(() => {
  hasScope.mockReturnValue(true);
});

describe("SettingsPageFoldRow", () => {
  it("holds the form of the page, flat, in a closed Settings row", () => {
    const wrapper = mountRow();

    const row = wrapper.get(ROW);
    expect(row.attributes("data-state")).toBe("closed");
    expect(row.text()).toContain("settings.settings");
    expect(row.text()).toContain("How many tracks are analyzed at once");
    expect(row.findComponent(Settings2).exists()).toBe(true);
    expect(wrapper.getComponent(settingsPageFormStub).props()).toEqual({
      page: "audio_analysis",
      flat: true,
    });
  });

  it("takes the label it is given", () => {
    const wrapper = mountRow({ label: "Task settings" });

    expect(wrapper.get(ROW).text()).toContain("Task settings");
    expect(wrapper.get(ROW).text()).not.toContain("settings.settings");
  });

  it("opens when the settings are reset, so the reset values are in view", async () => {
    const wrapper = mountRow();

    await wrapper.getComponent(settingsPageFormStub).vm.$emit("reset");

    expect(wrapper.get(ROW).attributes("data-state")).toBe("open");
  });

  it("renders nothing for a user who may not change the settings", () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const wrapper = mountRow();

    expect(wrapper.find(ROW).exists()).toBe(false);
    expect(wrapper.findComponent(settingsPageFormStub).exists()).toBe(false);
  });
});

function mountRow(props: { label?: string } = {}) {
  return mount(
    defineComponent({
      components: { SettingsFoldRows, SettingsPageFoldRow },
      setup: () => ({ props }),
      template: `
        <SettingsFoldRows>
          <SettingsPageFoldRow
            page="audio_analysis"
            description="How many tracks are analyzed at once"
            v-bind="props"
          />
        </SettingsFoldRows>
      `,
    }),
    { global: { stubs: { SettingsPageForm: settingsPageFormStub } } },
  );
}
