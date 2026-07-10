import MusicQuizUnsupportedGame from "@/components/music-quiz/MusicQuizUnsupportedGame.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

describe("MusicQuizUnsupportedGame", () => {
  it("shows an update-required state without player actions", () => {
    const wrapper = mount(MusicQuizUnsupportedGame);

    expect(wrapper.text()).toContain(
      "providers.music_quiz.unsupported_description",
    );
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("lets the host delete an unsupported game", async () => {
    const wrapper = mount(MusicQuizUnsupportedGame, {
      props: { canDelete: true },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("delete")).toHaveLength(1);
  });
});
