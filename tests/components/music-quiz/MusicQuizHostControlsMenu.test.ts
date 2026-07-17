import MusicQuizHostControlsMenu from "@/components/music-quiz/MusicQuizHostControlsMenu.vue";
import type {
  MusicQuizHostState,
  MusicQuizPhase,
} from "@/composables/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { nextTick, ref, type Ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDeleteGame,
  mockNext,
  mockReplay,
  mockReveal,
  mockStart,
  mockUseMusicQuizHost,
} = vi.hoisted(() => ({
  mockDeleteGame: vi.fn(),
  mockNext: vi.fn(),
  mockReplay: vi.fn(),
  mockReveal: vi.fn(),
  mockStart: vi.fn(),
  mockUseMusicQuizHost: vi.fn(),
}));

vi.mock("@/composables/useMusicQuizHost", () => ({
  useMusicQuizHost: mockUseMusicQuizHost,
}));

vi.mock("@/composables/useMusicQuiz", () => ({
  isSupportedMusicQuiz: (state: {
    answer_type?: string;
    quiz_type?: string;
  }) =>
    state.quiz_type === "guess_the_song" &&
    state.answer_type === "multiple_choice",
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) =>
    (
      ({
        "providers.music_quiz.end_game": "End game",
        "providers.music_quiz.finish": "Finish Quiz",
        "providers.music_quiz.host_controls": "Host controls",
        "providers.music_quiz.next": "Next Round",
        "providers.music_quiz.phase_reveal": "Reveal answer",
        "providers.music_quiz.play_again": "Play again",
        "providers.music_quiz.return_to_host_panel": "Return to host panel",
        "providers.music_quiz.start": "Start Quiz",
      }) as Record<string, string>
    )[key] ?? key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

const HOST_STATE = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "lobby",
  name: "Quiz",
  round_count: 5,
  suggestion_count: 4,
  answer_duration: 30,
  mode: "venue",
  players: [],
  created_at: 1,
  sources: [],
  join_url: "http://join",
  rounds: [],
  current_round: null,
} satisfies MusicQuizHostState;

let state: Ref<MusicQuizHostState | null>;
let busy: Ref<boolean>;
let isLastRound: Ref<boolean>;

describe("MusicQuizHostControlsMenu", () => {
  beforeEach(() => {
    state = ref({ ...HOST_STATE });
    busy = ref(false);
    isLastRound = ref(false);
    mockDeleteGame.mockReset();
    mockDeleteGame.mockResolvedValue(true);
    mockNext.mockReset();
    mockNext.mockResolvedValue(true);
    mockReplay.mockReset();
    mockReplay.mockResolvedValue(true);
    mockReveal.mockReset();
    mockReveal.mockResolvedValue(true);
    mockStart.mockReset();
    mockStart.mockResolvedValue(true);
    mockUseMusicQuizHost.mockReset();
    mockUseMusicQuizHost.mockReturnValue({
      state,
      busy,
      isLastRound,
      start: mockStart,
      reveal: mockReveal,
      next: mockNext,
      replay: mockReplay,
      deleteGame: mockDeleteGame,
    });
  });

  it.each([
    ["lobby", "quiz-host-start", "Start Quiz", "start"],
    ["answering", "quiz-host-reveal", "Reveal answer", "reveal"],
    ["reveal", "quiz-host-next", "Next Round", "next"],
    ["finished", "quiz-host-replay", "Play again", "replay"],
  ] as const)(
    "offers the %s host action",
    async (phase, testId, label, action) => {
      state.value = { ...HOST_STATE, phase };
      const wrapper = mountMenu();

      const button = wrapper.get(`[data-testid="${testId}"]`);
      expect(button.text()).toContain(label);
      await button.trigger("click");

      expect(
        {
          start: mockStart,
          reveal: mockReveal,
          next: mockNext,
          replay: mockReplay,
        }[action],
      ).toHaveBeenCalledOnce();
    },
  );

  it("uses Finish Quiz for the final reveal", () => {
    state.value = { ...HOST_STATE, phase: "reveal" };
    isLastRound.value = true;
    const wrapper = mountMenu();

    expect(wrapper.get('[data-testid="quiz-host-next"]').text()).toContain(
      "Finish Quiz",
    );
  });

  it("confirms before ending the game", async () => {
    const wrapper = mountMenu();

    await wrapper.get('[data-testid="quiz-host-end"]').trigger("click");
    await nextTick();
    await wrapper.get('[data-testid="confirm-end-game"]').trigger("click");

    expect(mockDeleteGame).toHaveBeenCalledOnce();
  });

  it("returns to the full host panel", async () => {
    const wrapper = mountMenu();

    await wrapper.get('[data-testid="quiz-host-panel"]').trigger("click");

    expect(wrapper.emitted("openHostPanel")).toEqual([[]]);
  });

  it("only offers the host panel when no game is active", () => {
    state.value = null;
    const wrapper = mountMenu();

    expect(wrapper.find('[data-testid="quiz-host-start"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="quiz-host-end"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="quiz-host-panel"]').exists()).toBe(true);
  });

  it("keeps host actions disabled while another action is running", () => {
    busy.value = true;
    const wrapper = mountMenu();

    expect(
      wrapper.get('[data-testid="quiz-host-start"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="quiz-host-end"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("loads only the host state needed by the menu", () => {
    mountMenu();

    expect(mockUseMusicQuizHost).toHaveBeenCalledWith({
      loadSetupData: false,
      notifyError: expect.any(Function),
    });
  });
});

function mountMenu() {
  const passthroughStub = { template: "<div><slot /></div>" };
  return mount(MusicQuizHostControlsMenu, {
    global: {
      stubs: {
        Button: {
          props: ["disabled"],
          template:
            '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
        },
        DropdownMenu: passthroughStub,
        DropdownMenuContent: passthroughStub,
        DropdownMenuItem: {
          props: ["disabled", "variant"],
          emits: ["click"],
          template:
            '<button v-bind="$attrs" :disabled="disabled" :data-variant="variant" @click="$emit(\'click\')"><slot /></button>',
        },
        DropdownMenuLabel: passthroughStub,
        DropdownMenuSeparator: true,
        DropdownMenuTrigger: passthroughStub,
        MusicQuizEndGameDialog: {
          props: ["modelValue", "busy"],
          emits: ["update:modelValue", "confirm"],
          template:
            '<button v-if="modelValue" data-testid="confirm-end-game" @click="$emit(\'update:modelValue\', false); $emit(\'confirm\')" />',
        },
      },
    },
  });
}
