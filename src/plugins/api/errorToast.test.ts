import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";
import { ConnectionState, MusicAssistantApi } from "./index";

vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

const failCommand = (error_code: number, details: string) => {
  const api = new MusicAssistantApi();
  api.state.value = ConnectionState.CONNECTED;
  // @ts-expect-error - inject a transport that accepts sends but never replies
  api.transport = { send: vi.fn(), disconnect: vi.fn() };
  api.sendCommand("players/all").catch(() => undefined);
  const messageId = [...api["commands"].keys()][0];
  api["handleResultMessage"]({ message_id: messageId, error_code, details });
};

const failCommandWithSuppressedGlobalError = (
  error_code: number,
  details: string,
) => {
  const api = new MusicAssistantApi();
  api.state.value = ConnectionState.CONNECTED;
  // @ts-expect-error - inject a transport that accepts sends but never replies
  api.transport = { send: vi.fn(), disconnect: vi.fn() };
  api
    .sendCommand("share/resolve", {}, { suppressGlobalError: true })
    .catch(() => undefined);
  const messageId = [...api["commands"].keys()][0];
  api["handleResultMessage"]({ message_id: messageId, error_code, details });
};

describe("error result toast", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it.each([
    [20, "Authenticatie is vereist."],
    [21, "Authenticatie mislukt."],
  ])("stays quiet for sign-in error code %i", (code, details) => {
    failCommand(code, details);

    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows other errors, whatever their text", () => {
    failCommand(6, "Invalid credentials");

    expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
  });

  it("leaves handled share command errors to the caller", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    failCommandWithSuppressedGlobalError(6, "Share resolution failed");
    expect(toast.error).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
});
