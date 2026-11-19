import type { SettingsRow } from "@/components/settings/SettingsLinkRows.vue";
import UserProfile from "@/views/UserProfile.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

describe("UserProfile", () => {
  it("shows who is signed in, the theme and language, and the rows below them", () => {
    const wrapper = shallowMount(UserProfile);

    expect(
      wrapper
        .findAll("*")
        .map((child) => child.element.tagName.toLowerCase())
        .filter((tag) => tag.endsWith("-stub")),
    ).toEqual([
      "profile-header-stub",
      "theme-language-card-stub",
      "settings-link-rows-stub",
    ]);
  });

  it("leads to the interface, this device and the security pages", () => {
    const rows = shallowMount(UserProfile)
      .getComponent({ name: "SettingsLinkRows" })
      .props("rows") as SettingsRow[];

    expect(
      rows.map(({ key, label, description, to }) => ({
        key,
        label,
        description,
        to,
      })),
    ).toEqual([
      {
        key: "interface",
        label: "auth.profile_pages.interface",
        description: "auth.profile_pages.interface_description",
        to: { name: "profileinterface" },
      },
      {
        key: "device",
        label: "auth.profile_pages.device",
        description: "auth.profile_pages.device_description",
        to: { name: "profiledevice" },
      },
      {
        key: "security",
        label: "auth.profile_pages.security",
        description: "auth.profile_pages.security_description",
        to: { name: "profilesecurity" },
      },
    ]);
  });
});
