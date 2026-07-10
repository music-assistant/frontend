import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSendCommand } = vi.hoisted(() => ({
  mockSendCommand: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    sendCommand: mockSendCommand,
  },
}));

import { createMusicQuiz } from "@/composables/useMusicQuiz";

describe("useMusicQuiz commands", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockSendCommand.mockResolvedValue(undefined);
  });

  it("sends difficulty in the create payload", async () => {
    await createMusicQuiz(
      "guess_the_song",
      5,
      4,
      30,
      "hard",
      ["library://track/1"],
      "Test Quiz",
    );

    expect(mockSendCommand).toHaveBeenCalledWith("music_quiz/create", {
      quiz_type: "guess_the_song",
      round_count: 5,
      suggestion_count: 4,
      answer_duration: 30,
      difficulty: "hard",
      source_uris: ["library://track/1"],
      name: "Test Quiz",
    });
  });
});
