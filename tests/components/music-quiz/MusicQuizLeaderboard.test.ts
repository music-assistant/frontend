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

  it("fills a constrained region and scrolls long rankings internally", () => {
    const manyRows = Array.from({ length: 30 }, (_, index) => ({
      ...rows[0],
      name: `Player ${index + 1} with a safely truncated long name`,
      rank: index + 1,
      score: Number.MAX_SAFE_INTEGER,
    }));
    const wrapper = mount(MusicQuizLeaderboard, {
      props: {
        rows: manyRows,
        scrollable: true,
      },
    });
    const card = wrapper.get('[data-slot="card"]');
    const content = wrapper.get('[data-slot="card-content"]');

    expect(card.attributes("role")).toBe("region");
    expect(card.attributes("aria-label")).toBe(
      "providers.music_quiz.leaderboard",
    );
    expect(card.classes()).toEqual(
      expect.arrayContaining(["min-h-0", "overflow-hidden"]),
    );
    expect(content.classes()).toEqual(
      expect.arrayContaining([
        "min-h-0",
        "flex-1",
        "overflow-y-auto",
        "overscroll-contain",
      ]),
    );
    expect(wrapper.findAll("li")).toHaveLength(30);
    expect(wrapper.get("li span.min-w-0.flex-1").classes()).toContain(
      "truncate",
    );
    const score = wrapper.get("li span.max-w-\\[45\\%\\]");
    expect(score.classes()).toContain("max-w-[45%]");
    expect(score.classes()).not.toContain("shrink-0");
    expect(score.get("strong").classes()).toEqual(
      expect.arrayContaining(["min-w-0", "flex-1", "truncate"]),
    );
    expect(score.get("span").classes()).toEqual(
      expect.arrayContaining(["min-w-0", "flex-1", "truncate"]),
    );
  });
});
