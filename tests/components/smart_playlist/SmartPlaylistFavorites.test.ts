import SmartPlaylistRuleRow from "@/components/smart_playlist/SmartPlaylistRuleRow.vue";
import SmartPlaylistRulesList from "@/components/smart_playlist/SmartPlaylistRulesList.vue";
import SmartPlaylistRulesView from "@/components/smart_playlist/SmartPlaylistRulesView.vue";
import type { RuleRow } from "@/composables/smart-playlist/useSmartPlaylistRulesForm";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({ default: { providers: {} } }));

enableAutoUnmount(afterEach);

const favoriteRule: RuleRow = {
  uid: "favorite",
  field: "favorite",
  operator: "is",
  values: [],
};

describe("smart playlist track release year", () => {
  it.each(["library", "seed"] as const)(
    "shows the missing-date warning only when the rule is present in %s mode",
    async (mode) => {
      const wrapper = mount(SmartPlaylistRulesList, {
        props: {
          mode,
          rules: [],
          logic: "AND",
          availableFields: [],
          genreOptions: [],
          albumTypeOptions: [],
          invalidRuleUids: new Set<string>(),
        },
      });
      const warning =
        "Many music sources do not provide a track release date. Tracks without one are excluded by this filter.";
      expect(wrapper.text()).not.toContain(warning);
      await wrapper.setProps({
        rules: [{ ...favoriteRule, uid: "track-year", field: "track_year" }],
      });
      expect(wrapper.text()).toContain(warning);
      await wrapper.setProps({ rules: [] });
      expect(wrapper.text()).not.toContain(warning);
    },
  );
});

describe("smart playlist favorites", () => {
  it("offers include and exclude and emits the selected operator", async () => {
    const wrapper = mount(SmartPlaylistRuleRow, {
      props: {
        rule: favoriteRule,
        availableFields: [],
        genreOptions: [],
        albumTypeOptions: [],
      },
      attachTo: document.body,
    });
    await flushPromises();
    const select = wrapper.findAll("[role='combobox']")[1];
    expect(select.text()).toContain("Only favorites");
    await select.trigger("keydown", { key: "ArrowDown" });
    const options = await vi.waitFor(() => {
      const rendered = [...document.querySelectorAll("[role='option']")];
      expect(rendered).toHaveLength(2);
      return rendered;
    });
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      "Only favorites",
      "Exclude favorites",
    ]);
    options[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushPromises();
    expect(wrapper.emitted("change-operator")).toEqual([["is_not"]]);
  });

  it("explains that exclusion is unconditional under OR", () => {
    const wrapper = mount(SmartPlaylistRulesList, {
      props: {
        mode: "library",
        rules: [{ ...favoriteRule, operator: "is_not" }],
        logic: "OR",
        availableFields: [],
        genreOptions: [],
        albumTypeOptions: [],
        invalidRuleUids: new Set<string>(),
      },
    });

    expect(wrapper.text()).toContain(
      "Your liked tracks are always excluded, even when they match another rule.",
    );
  });

  it("only offers exclusion in seed mode", async () => {
    const wrapper = mount(SmartPlaylistRuleRow, {
      props: {
        rule: { ...favoriteRule, operator: "is_not" },
        allowFavoritesOnly: false,
        availableFields: [],
        genreOptions: [],
        albumTypeOptions: [],
      },
    });
    await flushPromises();
    const select = wrapper.findAll("[role='combobox']")[1];
    expect(select.attributes("disabled")).toBeDefined();
    expect(select.text()).toContain("Exclude favorites");
  });

  it("shows the saved exclusion in the read-only rules view", () => {
    const wrapper = mount(SmartPlaylistRulesView, {
      props: {
        rules: {
          genre_ids: [],
          artist_ids: [],
          album_ids: [],
          favorites_only: false,
          exclude_favorites: true,
          logic: "OR",
          limit: 100,
        },
      },
    });
    expect(wrapper.text()).toContain("Exclude favorites");
    expect(wrapper.text()).not.toContain("Yes");
  });
});
