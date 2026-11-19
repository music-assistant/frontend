import SettingsIcon from "@/components/settings/SettingsIcon.vue";
import SettingsTiles, {
  type SettingsTile,
} from "@/components/settings/SettingsTiles.vue";
import { SETTINGS_COLORS } from "@/helpers/settings_colors";
import { ChevronRight, Library } from "@lucide/vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { markRaw } from "vue";

const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

enableAutoUnmount(afterEach);

describe("SettingsTiles", () => {
  it("renders nothing without tiles", () => {
    expect(mountTiles([]).html()).toBe("<!--v-if-->");
  });

  it("leads each tile to its page, saying what is behind it", () => {
    const wrapper = mountTiles([
      tile(),
      tile({ key: "genres", label: "Genre management", to: { name: "g" } }),
    ]);

    const library = wrapper.get('[data-testid="music-link-library"]');
    expect(JSON.parse(library.attributes("href")!)).toEqual({
      name: "librarysettings",
    });
    expect(library.text()).toContain("Library settings");
    expect(library.get('[data-testid="music-description"]').text()).toBe(
      "Which source plays a track",
    );
    expect(library.findComponent(ChevronRight).exists()).toBe(true);
    expect(
      wrapper
        .findAll('[data-testid^="music-link-"]')
        .map((link) => link.attributes("data-testid")),
    ).toEqual(["music-link-library", "music-link-genres"]);
  });

  it("shows the state of a tile beside its title", () => {
    const wrapper = mountTiles([
      tile({ state: "9 active" }),
      tile({ key: "b" }),
    ]);

    expect(
      wrapper
        .findAll('[data-testid="music-state"]')
        .map((state) => state.text()),
    ).toEqual(["9 active"]);
  });

  it("draws the icon soft, in the colour of the tile", () => {
    const wrapper = mountTiles([tile({ color: "pink" })]);

    const icon = wrapper.getComponent(SettingsIcon);
    expect(icon.props()).toMatchObject({ color: "pink", soft: true });
    expect(icon.attributes("style")).toContain(
      `color: ${SETTINGS_COLORS.pink}`,
    );
    expect(icon.classes()).toContain("bg-current/12");
  });

  it("lays the tiles out one or two across, by the room beside the sidebar", () => {
    const wrapper = mountTiles([tile()]);

    expect(wrapper.classes()).toContain("@container");
    expect(wrapper.get(".grid").classes()).toEqual(
      expect.arrayContaining(["grid-cols-1", "@3xl:grid-cols-2"]),
    );
  });
});

function tile(overrides: Partial<SettingsTile> = {}): SettingsTile {
  return {
    key: "library",
    icon: markRaw(Library),
    color: "indigo",
    label: "Library settings",
    description: "Which source plays a track",
    to: { name: "librarysettings" },
    ...overrides,
  };
}

function mountTiles(tiles: SettingsTile[]) {
  return mount(SettingsTiles, {
    props: { tiles, testIdPrefix: "music" },
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
}
