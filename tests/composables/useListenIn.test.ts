import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { EventType } from "@/plugins/api/interfaces";

const { mockSendCommand, mockSubscribeMulti } = vi.hoisted(() => ({
  mockSendCommand: vi.fn(),
  mockSubscribeMulti: vi.fn(() => () => {}),
}));

// Run lifecycle hooks eagerly so the composable can be exercised without a
// host component (mirrors the pattern used by other composable tests).
vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
    onBeforeUnmount: () => {},
  };
});

vi.mock("@/plugins/api", () => ({
  default: {
    sendCommand: mockSendCommand,
    subscribe_multi: mockSubscribeMulti,
  },
}));

vi.mock("@/plugins/web_player", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return { webPlayer: reactive({ player_id: "wp-1" as string | null }) };
});

import { webPlayer } from "@/plugins/web_player";
import { type ListenInMode, useListenIn } from "@/composables/useListenIn";

const errorMessages = {
  noWebPlayer: "no-web-player",
  listenIn: "start-failed",
  stopListenIn: "stop-failed",
};

function create(mode: ListenInMode | undefined = "venue") {
  const notifyError = vi.fn();
  const composable = useListenIn({
    domain: "party",
    mode: () => mode,
    notifyError,
    errorMessages,
    recheckEvents: [EventType.QUEUE_UPDATED],
  });
  return { ...composable, notifyError };
}

describe("useListenIn", () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockSubscribeMulti.mockReset();
    mockSubscribeMulti.mockReturnValue(() => {});
    webPlayer.player_id = "wp-1";
  });

  describe("checkCanListenIn", () => {
    it("queries can_listen_in for our web player and stores the result", async () => {
      mockSendCommand.mockResolvedValue(true);
      const { canListenIn, checkCanListenIn } = create();

      await checkCanListenIn();

      expect(mockSendCommand).toHaveBeenCalledWith("party/can_listen_in", {
        web_player_id: "wp-1",
      });
      expect(canListenIn.value).toBe(true);
    });

    it("stays unavailable and skips the command without a web player", async () => {
      webPlayer.player_id = null;
      mockSendCommand.mockResolvedValue(true);
      const { canListenIn, checkCanListenIn } = create();

      await checkCanListenIn();

      expect(mockSendCommand).not.toHaveBeenCalled();
      expect(canListenIn.value).toBe(false);
    });

    it("treats a failing check as unavailable", async () => {
      mockSendCommand.mockRejectedValue(new Error("boom"));
      const { canListenIn, checkCanListenIn } = create();

      await checkCanListenIn();

      expect(canListenIn.value).toBe(false);
    });
  });

  describe("mode-aware UX flags", () => {
    it("shows the venue toggle but never prompts in venue mode", async () => {
      mockSendCommand.mockResolvedValue(true);
      const {
        shouldShowListenInToggle,
        shouldPromptListenIn,
        checkCanListenIn,
      } = create("venue");

      await checkCanListenIn();

      expect(shouldShowListenInToggle.value).toBe(true);
      expect(shouldPromptListenIn.value).toBe(false);
    });

    it("prompts in remote mode until listening has started", async () => {
      mockSendCommand.mockResolvedValue(true);
      const {
        shouldShowListenInToggle,
        shouldPromptListenIn,
        enableListenIn,
        checkCanListenIn,
      } = create("remote");

      await checkCanListenIn();
      expect(shouldShowListenInToggle.value).toBe(true);
      expect(shouldPromptListenIn.value).toBe(true);

      await enableListenIn();
      expect(shouldPromptListenIn.value).toBe(false);
    });

    it("hides the toggle and prompt when no mode is set", async () => {
      mockSendCommand.mockResolvedValue(true);
      const {
        shouldShowListenInToggle,
        shouldPromptListenIn,
        checkCanListenIn,
      } = useListenIn({
        domain: "party",
        mode: () => undefined,
        notifyError: vi.fn(),
        errorMessages,
      });

      await checkCanListenIn();

      expect(shouldShowListenInToggle.value).toBe(false);
      expect(shouldPromptListenIn.value).toBe(false);
    });
  });

  describe("enableListenIn", () => {
    it("starts listening and clears busy on success", async () => {
      mockSendCommand.mockResolvedValue(undefined);
      const { isListeningIn, busy, enableListenIn } = create();

      const result = await enableListenIn();

      expect(result).toBe(true);
      expect(mockSendCommand).toHaveBeenCalledWith("party/listen_in", {
        web_player_id: "wp-1",
      });
      expect(isListeningIn.value).toBe(true);
      expect(busy.value).toBe(false);
    });

    it("notifies and bails out without a web player", async () => {
      webPlayer.player_id = null;
      const { isListeningIn, enableListenIn, notifyError } = create();

      const result = await enableListenIn();

      expect(result).toBe(false);
      expect(notifyError).toHaveBeenCalledWith("no-web-player");
      expect(mockSendCommand).not.toHaveBeenCalled();
      expect(isListeningIn.value).toBe(false);
    });

    it("reports the failure message and does not mark listening on error", async () => {
      mockSendCommand.mockRejectedValue(new Error("server-boom"));
      const { isListeningIn, busy, enableListenIn, notifyError } = create();

      const result = await enableListenIn();

      expect(result).toBe(false);
      expect(notifyError).toHaveBeenCalledWith("server-boom");
      expect(isListeningIn.value).toBe(false);
      expect(busy.value).toBe(false);
    });

    it("uses a custom getErrorMessage when provided", async () => {
      mockSendCommand.mockRejectedValue(new Error("ignored"));
      const notifyError = vi.fn();
      const { enableListenIn } = useListenIn({
        domain: "party",
        mode: () => "venue",
        notifyError,
        errorMessages,
        getErrorMessage: () => "friendly-message",
      });

      await enableListenIn();

      expect(notifyError).toHaveBeenCalledWith("friendly-message");
    });
  });

  describe("disableListenIn", () => {
    it("stops listening on success", async () => {
      mockSendCommand.mockResolvedValue(undefined);
      const { isListeningIn, disableListenIn } = create();

      const result = await disableListenIn();

      expect(result).toBe(true);
      expect(mockSendCommand).toHaveBeenCalledWith("party/stop_listen_in", {
        web_player_id: "wp-1",
      });
      expect(isListeningIn.value).toBe(false);
    });

    it("silently bails out without a web player", async () => {
      webPlayer.player_id = null;
      const { disableListenIn, notifyError } = create();

      const result = await disableListenIn();

      expect(result).toBe(false);
      expect(notifyError).not.toHaveBeenCalled();
      expect(mockSendCommand).not.toHaveBeenCalled();
    });

    it("reports the failure message on error", async () => {
      mockSendCommand.mockRejectedValue(new Error("stop-boom"));
      const { disableListenIn, notifyError } = create();

      const result = await disableListenIn();

      expect(result).toBe(false);
      expect(notifyError).toHaveBeenCalledWith("stop-boom");
    });
  });

  describe("subscriptions and reactivity", () => {
    it("subscribes to our own player updates plus the given recheck events on mount", () => {
      create();

      expect(mockSubscribeMulti).toHaveBeenCalledWith(
        [EventType.PLAYER_UPDATED, EventType.PLAYER_ADDED],
        expect.any(Function),
      );
      expect(mockSubscribeMulti).toHaveBeenCalledWith(
        [EventType.QUEUE_UPDATED],
        expect.any(Function),
      );
    });

    it("resets state when the web player goes away", async () => {
      mockSendCommand.mockResolvedValue(true);
      const { canListenIn, isListeningIn, enableListenIn, checkCanListenIn } =
        create();

      await checkCanListenIn();
      await enableListenIn();
      expect(canListenIn.value).toBe(true);
      expect(isListeningIn.value).toBe(true);

      webPlayer.player_id = null;
      await nextTick();

      expect(canListenIn.value).toBe(false);
      expect(isListeningIn.value).toBe(false);
    });
  });
});
