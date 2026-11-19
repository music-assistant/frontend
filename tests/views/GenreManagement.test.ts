import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import GenreManagement from "@/views/settings/GenreManagement.vue";
import { enableAutoUnmount, shallowMount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({ api: {}, default: {} }));
vi.mock("@/plugins/store", () => ({ store: {} }));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

enableAutoUnmount(afterEach);

describe("GenreManagement", () => {
  it("heads the page with the header of the genre management", () => {
    const wrapper = shallowMount(GenreManagement, {
      global: { mocks: { $t: (key: string) => key } },
    });

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "genres",
    );
  });
});
