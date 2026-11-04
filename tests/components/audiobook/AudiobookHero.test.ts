import AudiobookHero from "@/components/audiobook/AudiobookHero.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { audiobook } from "../../fixtures/audiobook";
import { artist } from "../../fixtures/artist";

vi.mock("@/plugins/breakpoint", () => ({ isPhoneSizedScreen: () => false }));
vi.mock("@/components/details/DetailHero.vue", () => ({
  default: {
    name: "DetailHero",
    props: ["item", "backdrop", "blurBackdrop"],
    emits: ["edit-rows"],
    template:
      '<div><slot name="toolbar-append" /><slot name="main" /><slot name="aside" /></div>',
  },
}));
vi.mock("@/components/details/DetailHeroFavorite.vue", () => ({
  default: { name: "DetailHeroFavorite", props: ["item"], template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroGenres.vue", () => ({
  default: { name: "DetailHeroGenres", props: ["item"], template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroPlayButton.vue", () => ({
  default: {
    name: "DetailHeroPlayButton",
    props: ["item"],
    template: "<div />",
  },
}));
vi.mock("@/components/details/DetailHeroProviders.vue", () => ({
  default: {
    name: "DetailHeroProviders",
    props: ["item"],
    template: "<div />",
  },
}));
vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { template: "<div />" },
}));

function mountHero(item = audiobook()) {
  return mount(AudiobookHero, {
    props: { item },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("AudiobookHero", () => {
  it("renders the title, version, authors, narrators and duration", () => {
    const wrapper = mountHero(
      audiobook({
        name: "The Book",
        version: "Unabridged",
        authors: [artist({ name: "Writer" })],
        narrators: ["Narrator"],
      }),
    );
    expect(wrapper.get("h1").text().replace(/\s+/g, " ")).toBe(
      "The Book (Unabridged)",
    );
    expect(wrapper.text()).toContain("Writer");
    expect(wrapper.text()).toContain("Narrator");
    expect(wrapper.text()).toContain("1:00:00");
  });

  it("delegates playback, favorites, genres and providers to shared components", () => {
    const book = audiobook();
    const wrapper = mountHero(book);
    for (const name of [
      "DetailHeroPlayButton",
      "DetailHeroFavorite",
      "DetailHeroGenres",
      "DetailHeroProviders",
    ]) {
      expect(wrapper.findComponent({ name }).props("item")).toEqual(book);
    }
  });

  it("forwards the shared hero's edit-rows action", async () => {
    const wrapper = mountHero();
    wrapper.findComponent({ name: "DetailHero" }).vm.$emit("edit-rows");
    await flushPromises();
    expect(wrapper.emitted("edit-rows")).toHaveLength(1);
  });

  it("does not offer actions while loading", async () => {
    const wrapper = mountHero();
    await wrapper.setProps({ item: undefined });
    expect(wrapper.find("h1").exists()).toBe(false);
    expect(
      wrapper.findComponent({ name: "DetailHeroPlayButton" }).exists(),
    ).toBe(false);
  });

  it.each([
    { duration: 3600, resume_position_ms: 900000, expected: "25" },
    { duration: 3600, resume_position_ms: 7200000, expected: "100" },
    { duration: 3600, fully_played: true, expected: "100" },
  ])("bounds whole-book progress to 0-100: $expected", (values) => {
    const { expected, ...overrides } = values;
    const wrapper = mountHero(audiobook(overrides));
    expect(
      wrapper.get('[role="progressbar"]').attributes("aria-valuenow"),
    ).toBe(expected);
    expect(
      wrapper.get('[data-slot="progress-indicator"]').attributes("style"),
    ).toContain(`translateX(-${100 - Number(expected)}%)`);
  });

  it.each([
    { duration: 0, resume_position_ms: 1000 },
    { resume_position_ms: -1000 },
    { resume_position_ms: null },
  ])("omits progress without a positive position and duration", (overrides) => {
    expect(
      mountHero(audiobook(overrides)).find('[role="progressbar"]').exists(),
    ).toBe(false);
  });

  it("distinguishes completed and in-progress books", () => {
    const completed = mountHero(audiobook({ fully_played: true }));
    expect(completed.get('[role="img"]').attributes("aria-label")).toBe(
      "item_fully_played",
    );
    const partial = mountHero(audiobook({ resume_position_ms: 900000 }));
    expect(partial.text()).toContain("item_in_progress");
    expect(partial.text()).toContain("15:00");
  });
});
