import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import SettingsPageFoldRow from "@/components/settings/SettingsPageFoldRow.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { ProviderType, Scope } from "@/plugins/api/interfaces";
import MetadataSettings from "@/views/settings/MetadataSettings.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

enableAutoUnmount(afterEach);

function mountPage() {
  return shallowMount(MetadataSettings, {
    global: {
      mocks: { $t: (key: string) => key },
      renderStubDefaultSlot: true,
    },
  });
}

describe("MetadataSettings", () => {
  it("heads the page with the header of the metadata", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = mountPage();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "metadata",
    );
  });

  it("folds the settings of the metadata in a row above the metadata sources", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = mountPage();
    const card = wrapper.getComponent(SettingsFoldRows);
    const list = wrapper.getComponent(ProviderList);

    expect(card.getComponent(SettingsPageFoldRow).props()).toMatchObject({
      page: "metadata",
      description: "settings.metadata_settings_description",
    });
    expect(list.props("type")).toBe(ProviderType.METADATA);
    expect(
      card.element.compareDocumentPosition(list.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("leaves the settings out for a role that may not change them", () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const wrapper = mountPage();

    expect(wrapper.findComponent(SettingsFoldRows).exists()).toBe(false);
    expect(wrapper.findComponent(ProviderList).exists()).toBe(true);
  });
});
