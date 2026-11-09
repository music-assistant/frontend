import ArtistDiscographyRow from "@/components/artist/ArtistDiscographyRow.vue";
import { DISCOGRAPHY_TYPES_PREFERENCE_KEY } from "@/components/artist/discographyRows";
import { AlbumType, type Album } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { album } from "../../fixtures/album";
import { artist } from "../../fixtures/artist";

const { storeMock, mockToggle } = vi.hoisted(() => ({
  storeMock: {
    currentUser: null as { preferences?: Record<string, unknown> } | null,
  },
  mockToggle: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("@/composables/userPreferences", () => ({
  updateUserPreferences: vi.fn(),
}));

vi.mock("@/components/artist/discographyRows", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/components/artist/discographyRows")
  >()),
  toggleDiscographyType: mockToggle,
}));

vi.mock("@/plugins/breakpoint", () => ({ isPhoneSizedScreen: () => false }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the shelf draws the row; only what the row hands it is read here
const ReleaseShelf = {
  name: "ReleaseShelf",
  props: ["viewAllTo", "items", "hideTitle", "itemCount"],
  template: "<div><slot name='label' /></div>",
};

const DiscographyTypePicker = {
  name: "DiscographyTypePicker",
  props: ["modelValue"],
  emits: ["toggle"],
  template: "<div />",
};

/** The row with these items, undefined while it loads. */
function mountRow(
  rowId: "discography" | "discography_second",
  items: Album[] | undefined,
  itemCount?: number,
) {
  return mount(ArtistDiscographyRow, {
    props: { rowId, artist: artist(), items, itemCount },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { ReleaseShelf, DiscographyTypePicker },
    },
  });
}

describe("ArtistDiscographyRow", () => {
  beforeEach(() => {
    storeMock.currentUser = null;
    mockToggle.mockReset();
  });

  it("opens the full discography on the row's types", () => {
    storeMock.currentUser = {
      preferences: {
        [DISCOGRAPHY_TYPES_PREFERENCE_KEY]: {
          discography: [AlbumType.ALBUM, AlbumType.EP],
        },
      },
    };
    const wrapper = mountRow("discography", [album()]);

    expect(
      wrapper.findComponent({ name: "ReleaseShelf" }).props("viewAllTo"),
    ).toEqual({
      name: "artistlisting",
      params: { provider: "library", itemId: "1", listing: "discography" },
      query: { types: "album,ep" },
    });
  });

  it("hands the picker the row's types and toggles a type on this row", async () => {
    const wrapper = mountRow("discography_second", [album()]);
    const picker = wrapper.findComponent({ name: "DiscographyTypePicker" });

    expect(picker.props("modelValue")).toEqual([AlbumType.LIVE]);
    await picker.vm.$emit("toggle", AlbumType.COMPILATION);

    expect(mockToggle).toHaveBeenCalledWith(
      "discography_second",
      AlbumType.COMPILATION,
    );
  });

  it("passes the full count to View all instead of duplicating the shelf length", () => {
    const wrapper = mountRow(
      "discography",
      Array.from({ length: 60 }, () => album()),
      123,
    );
    const shelf = wrapper.findComponent({ name: "ReleaseShelf" });
    expect(shelf.props("itemCount")).toBe(123);
    expect(shelf.props("items")).toHaveLength(50);
    expect(wrapper.text()).toBe("");
    expect(
      mountRow("discography", undefined)
        .findComponent({ name: "ReleaseShelf" })
        .props("itemCount"),
    ).toBeUndefined();
  });
});
