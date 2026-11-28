import SmartPlaylistRulesView from "@/components/smart_playlist/SmartPlaylistRulesView.vue";
import type { SmartPlaylistRules } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: { providers: {} },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

const baseRules: SmartPlaylistRules = {
  genre_ids: [],
  artist_ids: [],
  album_ids: [],
  favorites_only: false,
  logic: "AND",
  limit: 100,
};

describe("SmartPlaylistRulesView sources", () => {
  it.each([false, true])(
    "shows sources in order with preserve order %s",
    (preserve) => {
      const wrapper = mount(SmartPlaylistRulesView, {
        props: {
          rules: {
            ...baseRules,
            source_uris: ["service://album/1", "library://playlist/2"],
            source_names: {
              "service://album/1": "First album",
              "library://playlist/2": "Second playlist",
            },
            preserve_source_order: preserve,
          },
        },
      });
      const text = wrapper.text();
      expect(text).toContain("smart_playlist.type_sources");
      expect(text).toContain("smart_playlist.sources_heading");
      expect(text.indexOf("First album")).toBeLessThan(
        text.indexOf("Second playlist"),
      );
      expect(text.includes("smart_playlist.preserve_source_order")).toBe(
        preserve,
      );
      expect(text).not.toContain("smart_playlist.no_rules_title");
    },
  );
});
