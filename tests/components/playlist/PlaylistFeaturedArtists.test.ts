import PlaylistFeaturedArtists from "@/components/playlist/PlaylistFeaturedArtists.vue";
import {
  ArtistType,
  MediaType,
  type Artist,
  type ItemMapping,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../../fixtures/track";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { getArtist: vi.fn() },
}));
vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/components/artist/ArtistSimilarShelf.vue", () => ({
  default: {
    name: "ArtistSimilarShelf",
    props: ["title", "items"],
    emits: ["edit-rows"],
    template: "<div />",
  },
}));

const mapping = (name: string): ItemMapping => ({
  item_id: name,
  provider: "spotify",
  name,
  version: "",
  uri: `spotify://artist/${name}`,
  external_ids: [],
  is_playable: true,
  media_type: MediaType.ARTIST,
  available: true,
});

async function mountRow() {
  const tracks = [
    track({ artists: [mapping("Lane 8")] }),
    track({ artists: [mapping("Dezza")] }),
  ];
  const wrapper = mount(PlaylistFeaturedArtists, {
    props: { tracks },
    global: { mocks: { $t: (key: string) => key } },
  });
  await flushPromises();
  return wrapper;
}

const shelf = (wrapper: Awaited<ReturnType<typeof mountRow>>) =>
  wrapper.findComponent({ name: "ArtistSimilarShelf" });

describe("PlaylistFeaturedArtists", () => {
  beforeEach(() => {
    apiMock.getArtist.mockReset();
  });

  it("looks the artists up quietly, keeping a name when one fails", async () => {
    const lane8 = {
      ...mapping("Lane 8"),
      artist_type: ArtistType.SINGER,
    } as unknown as Artist;
    apiMock.getArtist
      .mockResolvedValueOnce(lane8)
      .mockRejectedValueOnce(new Error("not found"));
    const wrapper = await mountRow();

    expect(apiMock.getArtist).toHaveBeenCalledWith("Lane 8", "spotify", {
      suppressGlobalError: true,
    });
    const items = shelf(wrapper).props("items") as Array<{ name: string }>;
    expect(items.map((item) => item.name)).toEqual(["Lane 8", "Dezza"]);
    expect(items[0]).toEqual(lane8);
  });

  it("passes on the shelf's request to edit the rows", async () => {
    apiMock.getArtist.mockResolvedValue(mapping("Lane 8"));
    const wrapper = await mountRow();

    shelf(wrapper).vm.$emit("edit-rows");
    expect(wrapper.emitted("edit-rows")).toHaveLength(1);
  });
});
