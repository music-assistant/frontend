import ListingFiltersPanel from "@/components/listing-toolbar/ListingFiltersPanel.vue";
import type { ListingChoiceFilter } from "@/helpers/listing_filters";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const sourceFilter = (): ListingChoiceFilter => ({
  kind: "choice",
  id: "required_source",
  label: "Source",
  options: [
    { label: "Your library", value: "library" },
    { label: "Spotify", value: "spotify--1", domain: "spotify" },
  ],
  selected: "spotify--1",
  select: vi.fn(),
});

function mountPanel(filter: ListingChoiceFilter) {
  return mount(ListingFiltersPanel, {
    props: { filters: [filter], hasActiveFilters: false },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { ProviderIcon: true },
    },
  });
}

describe("ListingFiltersPanel", () => {
  it("hands over the picked choice", async () => {
    const filter = sourceFilter();
    const panel = mountPanel(filter);

    await panel.findAll("[role=radio]")[0].trigger("click");

    expect(filter.select).toHaveBeenCalledExactlyOnceWith("library");
  });

  // picking the source on screen keeps one a link carried in
  it("hands over a pick of the current choice too", async () => {
    const filter = sourceFilter();
    const panel = mountPanel(filter);

    await panel.findAll("[role=radio]")[1].trigger("click");

    expect(filter.select).toHaveBeenCalledExactlyOnceWith("spotify--1");
  });
});
