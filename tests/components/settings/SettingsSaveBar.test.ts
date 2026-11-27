import SettingsSaveBar from "@/components/settings/SettingsSaveBar.vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock } = vi.hoisted(() => ({
  storeMock: { frameless: false, mobileLayout: false },
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));

const BAR = '[data-testid="settings-save-bar"]';
const MOBILE_OFFSET =
  "bottom-[calc(var(--mobile-player-scrim-height)-var(--mobile-page-clearance))]";

beforeEach(() => {
  storeMock.frameless = false;
  storeMock.mobileLayout = false;
});

describe("SettingsSaveBar", () => {
  it("pins the save action to the bottom of the page, above the player bar", () => {
    const bar = mountBar({ unsavedChanges: true }).get(BAR);

    expect(bar.classes()).toEqual(
      expect.arrayContaining(["sticky", "bottom-4"]),
    );
    expect(bar.find('[data-testid="save"]').exists()).toBe(true);
  });

  it("shows only while there are unsaved changes", async () => {
    const wrapper = mountBar();
    expect(wrapper.find(BAR).exists()).toBe(false);
    expect(wrapper.find('[data-testid="save"]').exists()).toBe(false);

    await wrapper.setProps({ unsavedChanges: true });
    expect(wrapper.find(BAR).exists()).toBe(true);

    await wrapper.setProps({ unsavedChanges: false });
    expect(wrapper.find(BAR).exists()).toBe(false);
  });

  // a live region only announces a change of its text, not its own arrival
  it("announces the unsaved changes from a status that outlives the bar", async () => {
    const wrapper = mountBar();
    const status = wrapper.get('[role="status"]');
    expect(status.text()).toBe("");

    await wrapper.setProps({ unsavedChanges: true });

    expect(wrapper.get('[role="status"]').element).toBe(status.element);
    expect(status.text()).toBe("settings.unsaved_changes");
  });

  it("keeps clear of the mobile player bar and navigation", () => {
    storeMock.mobileLayout = true;

    const bar = mountBar({ unsavedChanges: true }).get(BAR);

    expect(bar.classes()).toContain(MOBILE_OFFSET);
    expect(bar.classes()).not.toContain("bottom-4");
  });

  it("sits at the bottom of a frameless page, which has no bars", () => {
    storeMock.mobileLayout = true;
    storeMock.frameless = true;

    const bar = mountBar({ unsavedChanges: true }).get(BAR);

    expect(bar.classes()).toContain("bottom-4");
    expect(bar.classes()).not.toContain(MOBILE_OFFSET);
  });

  it("always leaves only the save action in the flow of the form when inline", () => {
    const wrapper = mountBar({ inline: true });

    expect(wrapper.find(BAR).exists()).toBe(false);
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="save"]').exists()).toBe(true);
  });
});

function mountBar(props: { inline?: boolean; unsavedChanges?: boolean } = {}) {
  return mount(SettingsSaveBar, {
    props: { unsavedChanges: false, ...props },
    slots: { default: "<button data-testid='save' />" },
  });
}
