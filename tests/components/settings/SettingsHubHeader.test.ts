import SettingsHubHeader from "@/components/settings/SettingsHubHeader.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

describe("SettingsHubHeader", () => {
  it.each([
    ["music", "settings.music", "settings.music_description"],
    ["system", "settings.system", "settings.system_description"],
    [
      "metadata_providers",
      "metadata",
      "settings.metadata_providers_description",
    ],
  ])(
    "heads %s with the title and description of its card or tile",
    (name, title, description) => {
      const wrapper = mount(SettingsHubHeader, { props: { name } });

      expect(wrapper.get("h1").text()).toBe(title);
      expect(wrapper.get("p").text()).toBe(description);
    },
  );

  it("draws no icon", () => {
    const wrapper = mount(SettingsHubHeader, { props: { name: "music" } });

    expect(wrapper.find("svg").exists()).toBe(false);
  });

  it("keeps the header to the title on a phone", () => {
    const wrapper = mount(SettingsHubHeader, { props: { name: "music" } });

    expect(wrapper.get("p").classes()).toContain("max-md:hidden");
  });

  it("renders nothing for a page it does not know", () => {
    const wrapper = mount(SettingsHubHeader, {
      props: { name: "constructor" },
    });

    expect(wrapper.find("header").exists()).toBe(false);
  });
});
