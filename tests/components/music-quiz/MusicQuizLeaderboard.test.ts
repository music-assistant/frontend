import MusicQuizLeaderboard, {
  type MusicQuizLeaderboardRow,
} from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

const rows: MusicQuizLeaderboardRow[] = [
  {
    name: "Leader",
    score: 20,
    ready: false,
    answered: true,
    active_from_round: 0,
    rank: 1,
    roundScoreLabel: "+10",
  },
  {
    name: "Current Player",
    score: 10,
    ready: false,
    answered: true,
    active_from_round: 0,
    rank: 2,
    roundScoreLabel: "",
  },
];

describe("MusicQuizLeaderboard", () => {
  it("renders compact rows in a bounded ranking card", () => {
    const wrapper = mount(MusicQuizLeaderboard, {
      props: {
        rows,
        currentPlayerName: "Current Player",
        compact: true,
      },
    });

    expect(wrapper.get('[data-slot="card"]').classes()).toEqual(
      expect.arrayContaining(["gap-2", "py-2"]),
    );
    expect(wrapper.get('[data-slot="card-header"]').classes()).toContain(
      "px-3",
    );
    expect(wrapper.get('[data-slot="card-title"]').classes()).toContain(
      "text-sm",
    );
    expect(wrapper.get('[data-slot="card-content"]').classes()).toEqual(
      expect.arrayContaining(["max-h-56", "overflow-y-auto", "px-2"]),
    );

    const renderedRows = wrapper.findAll("li");
    expect(renderedRows).toHaveLength(2);
    expect(renderedRows[0].text()).toContain("Leader");
    expect(renderedRows[0].text()).toContain("20");
    expect(renderedRows[0].text()).toContain("+10");
    expect(renderedRows[1].text()).toContain("Current Player");
    expect(renderedRows[1].text()).toContain("10");
    expect(renderedRows[1].attributes("aria-current")).toBe("true");
    expect(renderedRows[1].classes()).toContain("bg-primary/10");
    expect(
      renderedRows[1].findComponent({ name: "MusicQuizAvatar" }).classes(),
    ).toContain("size-6");
  });
});
