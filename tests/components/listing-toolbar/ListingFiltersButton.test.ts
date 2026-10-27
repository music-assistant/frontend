import ListingFiltersButton from "@/components/listing-toolbar/ListingFiltersButton.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

describe("ListingFiltersButton", () => {
  it("names the panel it opens", async () => {
    const button = mount(ListingFiltersButton, {
      attachTo: document.body,
      props: { filters: [], activeCount: 0 },
      global: { mocks: { $t: (key: string) => key } },
    });

    await button.find("button").trigger("click");
    await flushPromises();

    expect(
      document.body
        .querySelector('[role="dialog"]')
        ?.getAttribute("aria-label"),
    ).toBe("listing_filters.title");
    button.unmount();
  });
});
