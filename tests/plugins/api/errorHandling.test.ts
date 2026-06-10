import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockToastError } = vi.hoisted(() => ({
  mockToastError: vi.fn(),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: mockToastError,
    info: vi.fn(),
    success: vi.fn(),
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/store", () => ({ store: {} }));

import { api } from "@/plugins/api";
import { ApiError, isMediaNotFoundError } from "@/plugins/api/errors";

function seedCommand(suppressErrorToast?: boolean) {
  const resolve = vi.fn();
  const reject = vi.fn();
  (api as any).commands.set("42", { resolve, reject, suppressErrorToast });
  return { resolve, reject };
}

function sendErrorResult(details = "playlist not found in library: 123") {
  (api as any).handleResultMessage({
    message_id: "42",
    error_code: 2,
    details,
  });
}

describe("api error result handling", () => {
  beforeEach(() => {
    mockToastError.mockReset();
    (api as any).commands.clear();
  });

  it("rejects the pending command with an ApiError carrying the error code", () => {
    const { reject } = seedCommand();

    sendErrorResult();

    expect(reject).toHaveBeenCalledTimes(1);
    const err = reject.mock.calls[0][0];
    expect(err).toBeInstanceOf(ApiError);
    expect(isMediaNotFoundError(err)).toBe(true);
    expect((err as ApiError).message).toBe(
      "playlist not found in library: 123",
    );
  });

  it("shows the global error toast by default", () => {
    seedCommand();

    sendErrorResult();

    expect(mockToastError).toHaveBeenCalledTimes(1);
  });

  it("skips the global error toast when the command opted out", () => {
    const { reject } = seedCommand(true);

    sendErrorResult();

    expect(mockToastError).not.toHaveBeenCalled();
    expect(reject).toHaveBeenCalledTimes(1);
  });

  it("does not match other error codes as media-not-found", () => {
    expect(isMediaNotFoundError(new ApiError(1, "provider unavailable"))).toBe(
      false,
    );
    expect(isMediaNotFoundError(new Error("connection lost"))).toBe(false);
    expect(isMediaNotFoundError("playlist not found in library: 123")).toBe(
      false,
    );
  });
});
