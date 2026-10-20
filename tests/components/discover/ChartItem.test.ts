import ChartItem from "@/components/discover/ChartItem.vue";
import type { MediaItemTypeOrItemMapping } from "@/plugins/api/interfaces";
import { MediaType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { handlePlayBtnClick } = vi.hoisted(() => ({
  handlePlayBtnClick: vi.fn(),
}));

vi.mock("@/components/discover/editorialArtwork", () => ({
  itemArtwork: (item: { name: string }) => ({
    image: undefined,
    gradient: "none",
    initials: item.name.slice(0, 2).toUpperCase(),
  }),
}));
vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: vi.fn(),
  handleMenuBtnClick: vi.fn(),
  handlePlayBtnClick,
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

function renderItem(available: boolean) {
  const item = {
    item_id: "track-1",
    provider: "library",
    media_type: MediaType.TRACK,
    uri: "track://library/track-1",
    name: "Track",
    available,
  } as MediaItemTypeOrItemMapping;

  return mount(ChartItem, {
    props: { item, position: 1, playCount: 3 },
    global: { directives: { hold: () => undefined } },
  });
}

describe("ChartItem play control", () => {
  it("renders the initials artwork fallback when there is no image", () => {
    const wrapper = renderItem(true);

    expect(wrapper.get('[aria-hidden="true"]').text().trim()).toBe("TR");
  });

  it("disables playback for unavailable history items", async () => {
    const wrapper = renderItem(false);
    const playButton = wrapper.get('button[aria-label="play"]');

    expect((playButton.element as HTMLButtonElement).disabled).toBe(true);
    expect(playButton.classes()).toContain("pointer-events-none");
    await playButton.trigger("click");
    expect(handlePlayBtnClick).not.toHaveBeenCalled();
  });

  it("keeps playback enabled for available items", async () => {
    const wrapper = renderItem(true);
    const playButton = wrapper.get('button[aria-label="play"]');

    expect((playButton.element as HTMLButtonElement).disabled).toBe(false);
    expect(playButton.classes()).toContain("pointer-events-none");
    expect(playButton.classes()).toContain("group-hover:pointer-events-auto");
    expect(playButton.classes()).toContain("focus-visible:pointer-events-auto");
    expect(playButton.classes()).toContain(
      "[@media(hover:none)]:pointer-events-auto",
    );
    await playButton.trigger("click");
    expect(handlePlayBtnClick).toHaveBeenCalledOnce();
  });
});
