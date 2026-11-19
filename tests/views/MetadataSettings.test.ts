import ProviderList from "@/components/settings/providers/ProviderList.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { ProviderType } from "@/plugins/api/interfaces";
import MetadataSettings from "@/views/settings/MetadataSettings.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

enableAutoUnmount(afterEach);

describe("MetadataSettings", () => {
  it("heads the page with the header of the metadata", () => {
    const wrapper = shallowMount(MetadataSettings);

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "metadata",
    );
  });

  it("shows the settings of the metadata below the metadata sources", () => {
    const wrapper = shallowMount(MetadataSettings);
    const list = wrapper.getComponent(ProviderList);
    const form = wrapper.getComponent(SettingsPageForm);

    expect(list.props("type")).toBe(ProviderType.METADATA);
    expect(form.props("page")).toBe("metadata");
    expect(
      list.element.compareDocumentPosition(form.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
