import MusicQuizPlayerHeader from "@/components/music-quiz/MusicQuizPlayerHeader.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

describe("MusicQuizPlayerHeader", () => {
  it("renders no result pills when roundResults is empty or absent", () => {
    const wrapper = mount(MusicQuizPlayerHeader, {
      props: {
        playerName: "Player",
        rank: 1,
        score: 10,
        scoreDelta: "",
      },
    });

    expect(wrapper.findAll('[data-testid="player-round-result"]')).toHaveLength(
      0,
    );
  });

  it("renders a pill per round result, styled by correctness", () => {
    const wrapper = mount(MusicQuizPlayerHeader, {
      props: {
        playerName: "Player",
        rank: 1,
        score: 10,
        scoreDelta: "(+15)",
        roundResults: [
          { key: "placement", label: "Placement", correct: true, points: 10 },
          { key: "artist", label: "Artist bonus", correct: false, points: 0 },
        ],
      },
    });

    const pills = wrapper.findAll('[data-testid="player-round-result"]');
    expect(pills).toHaveLength(2);

    expect(pills[0].text()).toContain("Placement");
    expect(pills[0].text()).toContain("+10");
    expect(pills[0].classes()).toEqual(
      expect.arrayContaining(["bg-green-500/15", "text-green-600"]),
    );

    expect(pills[1].text()).toContain("Artist bonus");
    expect(pills[1].text()).toContain("+0");
    expect(pills[1].classes()).toEqual(
      expect.arrayContaining(["bg-red-500/10", "text-destructive"]),
    );
  });
});
