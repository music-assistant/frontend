import { useSmartPlaylistRulesForm } from "@/composables/smart-playlist/useSmartPlaylistRulesForm";
import type { SmartPlaylistRules } from "@/plugins/api/interfaces";
import { flushPromises, mount, enableAutoUnmount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";

vi.mock("@/plugins/api", () => ({
  default: { providers: {}, countSmartPlaylistTracks: vi.fn() },
}));

vi.mock("@vueuse/core", async () => ({
  ...(await vi.importActual<typeof import("@vueuse/core")>("@vueuse/core")),
  useDebounceFn: () => vi.fn(),
}));

vi.mock("@/composables/smart-playlist/useSmartPlaylistGenres", () => ({
  useSmartPlaylistGenres: () => ({
    genres: ref([]),
    genreOptions: ref([]),
  }),
}));

enableAutoUnmount(afterEach);

function createForm(initialRules?: SmartPlaylistRules) {
  let form!: ReturnType<typeof useSmartPlaylistRulesForm>;
  mount(
    defineComponent({
      setup() {
        form = useSmartPlaylistRulesForm({ initialRules }, vi.fn());
        return () => null;
      },
    }),
  );
  return form;
}

const baseRules: SmartPlaylistRules = {
  genre_ids: [],
  artist_ids: [],
  album_ids: [],
  favorites_only: false,
  logic: "AND",
  limit: 100,
};

describe("smart playlist favorite rules", () => {
  it("keeps older unrestricted rules unrestricted", async () => {
    const form = createForm(baseRules);
    await flushPromises();
    expect(form.rules.value).toEqual([]);
    expect(form.getFinalRules()).toMatchObject({
      favorites_only: false,
      exclude_favorites: false,
    });

    expect(form.hasChanges.value).toBe(false);
  });

  it.each([
    ["is", true, false],
    ["is_not", false, true],
  ] as const)(
    "loads and round-trips the %s favorite rule",
    async (operator, favorites_only, exclude_favorites) => {
      const form = createForm({
        ...baseRules,
        favorites_only,
        exclude_favorites,
        logic: "OR",
      });
      await flushPromises();
      expect(form.rules.value).toEqual([
        expect.objectContaining({ field: "favorite", operator }),
      ]);
      expect(form.getFinalRules()).toMatchObject({
        favorites_only,
        exclude_favorites,
        logic: "OR",
      });
      expect(form.hasChanges.value).toBe(false);
    },
  );

  it("switches between include and exclude without sending conflicting flags", () => {
    const form = createForm();
    form.addRule("favorite");
    expect(form.getFinalRules()).toMatchObject({
      favorites_only: true,
      exclude_favorites: false,
    });
    form.rules.value[0].operator = "is_not";
    expect(form.getFinalRules()).toMatchObject({
      favorites_only: false,
      exclude_favorites: true,
    });
    expect(form.availableFields.value).not.toContain("favorite");
    expect(form.validate()).toEqual([]);
    form.removeRule(form.rules.value[0].uid);
    expect(form.getFinalRules()).toMatchObject({
      favorites_only: false,
      exclude_favorites: false,
    });
  });

  it("allows favorite exclusion for seed playlists without enabling favorites-only", () => {
    const form = createForm();
    form.setMode("seed");
    expect(form.availableFields.value).toContain("favorite");
    form.addRule("favorite");
    expect(form.rules.value[0].operator).toBe("is_not");
    expect(form.getFinalRules()).toMatchObject({
      favorites_only: false,
      exclude_favorites: true,
    });
  });
});

describe("selected smart playlist sources", () => {
  it("uses library filters without requiring a similar-tracks provider", () => {
    const form = createForm();
    form.setMode("sources");
    expect(form.validate()).toHaveLength(1);
    form.sourceItems.addSeed({
      uri: "service--one://playlist/123",
      kind: "playlist",
      name: "Mix",
    });
    form.addRule("favorite");
    expect(form.availableFields.value).toContain("artist");
    expect(form.getFinalRules()).toMatchObject({
      source_uris: ["service--one://playlist/123"],
      source_names: { "service--one://playlist/123": "Mix" },
      favorites_only: true,
    });
    expect(form.validate()).toEqual([]);
    form.setMode("library");
    expect(form.getFinalRules().source_uris).toBeUndefined();
    form.setMode("sources");
    expect(form.getFinalRules().source_uris).toEqual([
      "service--one://playlist/123",
    ]);
  });

  it("restores selected sources without resolving every item again", async () => {
    const form = createForm({
      ...baseRules,
      source_uris: ["service--one://album/123"],
      source_names: { "service--one://album/123": "Album" },
    });
    await flushPromises();
    expect(form.mode.value).toBe("sources");
    expect(form.sourceItems.seeds.value).toEqual([
      { uri: "service--one://album/123", kind: "album", name: "Album" },
    ]);
    expect(form.hasChanges.value).toBe(false);
  });
});
