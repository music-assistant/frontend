import TrackTableRow from "@/components/track-table/TrackTableRow.vue";
import { album } from "../../fixtures/album";
import { track } from "../../fixtures/track";
import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { TrackColumn } from "@/components/track-table/trackTableColumns";

vi.mock("@/helpers/favorites", () => ({
  canHoldFavorite: () => false,
  favoriteState: () => false,
}));
vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: vi.fn(),
  handleMenuBtnClick: vi.fn(),
  handlePlayBtnClick: vi.fn(),
}));
vi.mock("@/helpers/camelot", () => ({ camelotColor: () => "" }));
vi.mock("@/helpers/utils", () => ({ formatDuration: () => "" }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: () => false } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const TrackTableLinksStub = defineComponent({
  name: "TrackTableLinks",
  props: {
    targets: { type: Array, required: true },
    routeName: { type: String, required: true },
  },
  template:
    '<span :data-route="routeName">{{ targets.map((target) => target.name).join(" | ") }}</span>',
});

function mountTrackRow(item: ReturnType<typeof track>, columns: TrackColumn[]) {
  return mount(TrackTableRow, {
    props: { item, index: 0, columns, isSelected: false },
    global: {
      directives: { hold: {} },
      stubs: {
        FavoriteButton: true,
        MediaItemThumb: true,
        NowPlayingBadge: true,
        TrackTableLinks: TrackTableLinksStub,
      },
    },
  });
}

describe("TrackTableRow shared preview album metadata", () => {
  it.each([
    { columns: ["title"] as TrackColumn[] },
    { columns: ["title", "album"] as TrackColumn[] },
  ])(
    "renders an unresolved preview album as text for columns $columns",
    ({ columns }) => {
      const item = track({
        provider: "builtin",
        item_id: "share-preview://track/encoded",
        album: album({ item_id: "Album", provider: "builtin", name: "Album" }),
      });
      const wrapper = mountTrackRow(item, columns);

      expect(wrapper.text()).toContain("Album");
      expect(wrapper.find('[data-route="album"]').exists()).toBe(false);
    },
  );

  it.each([
    { columns: ["title"] as TrackColumn[] },
    { columns: ["title", "album"] as TrackColumn[] },
  ])("keeps resolved track album links for columns $columns", ({ columns }) => {
    const item = track({
      provider: "library",
      album: album({ item_id: "Album", provider: "library", name: "Album" }),
    });
    const wrapper = mountTrackRow(item, columns);

    expect(wrapper.find('[data-route="album"]').text()).toBe("Album");
  });
});
