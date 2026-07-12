import MusicQuizUnsupportedGame from "@/components/music-quiz/MusicQuizUnsupportedGame.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) =>
    key === "providers.music_quiz.end_game" ? "End game" : key,
}));

describe("MusicQuizUnsupportedGame", () => {
  it("shows an update-required state without player actions", () => {
    const wrapper = mount(MusicQuizUnsupportedGame);

    expect(wrapper.text()).toContain(
      "providers.music_quiz.unsupported_description",
    );
    expect(wrapper.get('[data-slot="card-header"]').classes()).toContain(
      "justify-items-center",
    );
    expect(
      wrapper.get('svg[aria-hidden="true"]').attributes("aria-hidden"),
    ).toBe("true");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("lets the host end an unsupported game", async () => {
    const wrapper = mount(MusicQuizUnsupportedGame, {
      props: { canEndGame: true },
    });

    expect(wrapper.get("button").text()).toContain("End game");
    expect(wrapper.text()).not.toContain("Delete");
    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("endGame")).toHaveLength(1);
  });
});
