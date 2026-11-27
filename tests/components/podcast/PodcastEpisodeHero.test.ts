import DetailHeroLink from "@/components/details/DetailHeroLink.vue";
import PodcastEpisodeHero from "@/components/podcast/PodcastEpisodeHero.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { podcast } from "../../fixtures/podcast";
import { podcastEpisode } from "../../fixtures/podcastEpisode";

const { mockRouterPush } = vi.hoisted(() => ({ mockRouterPush: vi.fn() }));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));
vi.mock("@/plugins/breakpoint", () => ({ isPhoneSizedScreen: () => false }));
// the numbering is built from placeholders, so the args have to come through with it
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}(${args.join(",")})` : key,
}));
vi.mock("@/components/details/DetailHero.vue", async () => ({
  default: (await import("../details/detailHeroStub")).detailHeroStub,
}));
vi.mock("@/components/details/DetailHeroButton.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroGenres.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroPlayButton.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroProviders.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { template: "<div />" },
}));

const PROVIDER_SHOW = podcast({ item_id: "pod1", provider: "rss" });
const EPISODE = podcastEpisode({ podcast: PROVIDER_SHOW });

function mountHero(props: InstanceType<typeof PodcastEpisodeHero>["$props"]) {
  return mount(PodcastEpisodeHero, {
    props,
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("PodcastEpisodeHero", () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
  });

  it("opens the library page of a podcast in the library", async () => {
    const wrapper = mountHero({
      item: EPISODE,
      parentPodcast: podcast({ item_id: "7", provider: "library" }),
    });

    await wrapper.getComponent(DetailHeroLink).trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "podcast",
      params: { itemId: "7", provider: "library" },
    });
  });

  it("opens the episode's podcast before the podcast has loaded", async () => {
    const wrapper = mountHero({ item: EPISODE });

    await wrapper.getComponent(DetailHeroLink).trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({
      name: "podcast",
      params: { itemId: "pod1", provider: "rss" },
    });
  });

  it("shows the episode number first, read out in full", () => {
    const wrapper = mountHero({
      item: podcastEpisode({
        season: 1,
        episode_number: 53,
        podcast: PROVIDER_SHOW,
      }),
    });

    const number = wrapper.get('[title="season_episode_number(1,53)"]');
    // first among the facts, ahead of the date and duration
    expect(number.element.parentElement?.firstElementChild).toBe(
      number.element,
    );
    expect(number.attributes("title")).toBe("season_episode_number(1,53)");
    expect(number.get("[aria-hidden='true']").text()).toBe(
      "season_episode_number_short(1,53)",
    );
    expect(number.get(".sr-only").text()).toBe("season_episode_number(1,53)");
  });

  it("shows the number when the episode has no date or duration", () => {
    const wrapper = mountHero({
      item: podcastEpisode({
        duration: 0,
        episode_number: 53,
        podcast: PROVIDER_SHOW,
      }),
    });

    const number = wrapper.get('[title="episode_number(53)"]');
    expect(number.element.parentElement?.children).toHaveLength(1);
    expect(number.text()).toContain("episode_number_short(53)");
  });

  it("forwards the shared hero's edit-rows action", async () => {
    const wrapper = mountHero({ item: EPISODE });
    wrapper.findComponent({ name: "DetailHero" }).vm.$emit("edit-rows");
    await flushPromises();
    expect(wrapper.emitted("edit-rows")).toHaveLength(1);
  });
});
