import SettingsOverview from "@/components/settings/SettingsOverview.vue";
import SettingsSectionLink from "@/components/settings/SettingsSectionLink.vue";
import {
  availableSettingsSections,
  type SettingsMenuPage,
} from "@/helpers/settings_sections";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../fixtures/scopes";

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

enableAutoUnmount(afterEach);

const ADMIN_SECTIONS = availableSettingsSections(
  scopeChecker(BUILTIN_ROLE_SCOPES.admin),
);

describe("SettingsOverview as cards", () => {
  it("leads with the Marketplace as a banner inviting to browse it", () => {
    const wrapper = mountOverview(ADMIN_SECTIONS, "card");

    const banner = wrapper.get('[data-testid="settings-marketplace-banner"]');
    expect(wrapper.get("a").attributes("data-testid")).toBe(
      "settings-marketplace-banner",
    );
    expect(JSON.parse(banner.attributes("href")!)).toEqual({
      name: "catalog",
    });
    expect(banner.get("h3").text()).toBe("settings.catalog.title");
    expect(banner.text()).toContain("settings.catalog.description");
    expect(banner.text()).toContain("browse");
  });

  it("features Music and Players with their icon beside their text", () => {
    const wrapper = mountOverview(ADMIN_SECTIONS, "card");

    expect(sectionsOf(wrapper, "featured")).toEqual(["music", "players"]);
    const music = wrapper.get('[data-testid="settings-section-featured"]');
    expect(music.text()).toContain("settings.music_description");
  });

  it("shows the other sections as compact cards, in their order", () => {
    const wrapper = mountOverview(ADMIN_SECTIONS, "card");

    expect(sectionsOf(wrapper, "card")).toEqual([
      "plugin_providers",
      "ai",
      "profile",
      "users",
      "system",
      "about",
    ]);
  });

  it("leaves the banner out for a role that may not add anything", () => {
    const wrapper = mountOverview(
      availableSettingsSections(scopeChecker(BUILTIN_ROLE_SCOPES.guest)),
      "card",
    );

    expect(
      wrapper.find('[data-testid="settings-marketplace-banner"]').exists(),
    ).toBe(false);
    expect(sectionsOf(wrapper, "featured")).toEqual([]);
  });
});

describe("SettingsOverview as a list", () => {
  it("lists every section in its order, the Marketplace first", () => {
    const wrapper = mountOverview(ADMIN_SECTIONS, "list");

    expect(
      wrapper
        .findAllComponents(SettingsSectionLink)
        .map((link) => link.props("section").key),
    ).toEqual(ADMIN_SECTIONS.map((section) => section.key));
    expect(
      wrapper.find('[data-testid="settings-marketplace-banner"]').exists(),
    ).toBe(false);
  });
});

function mountOverview(
  sections: readonly SettingsMenuPage[],
  viewMode: "list" | "card",
) {
  return mount(SettingsOverview, {
    props: { sections, viewMode },
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
}

// the sections shown as the given kind of card, in their order
function sectionsOf(
  wrapper: ReturnType<typeof mountOverview>,
  variant: "featured" | "card",
) {
  return wrapper
    .findAllComponents(SettingsSectionLink)
    .filter((link) => link.props("variant") === variant)
    .map((link) => link.props("section").key);
}
