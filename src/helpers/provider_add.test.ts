import type { DeleteConfirmationDialogEvent } from "@/plugins/eventbus";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import { startAddProvider } from "./provider_add";

const { apiMock, eventbusMock } = vi.hoisted(() => ({
  apiMock: {
    getProvider: vi.fn(),
    getProviderName: vi.fn(),
  },
  eventbusMock: { emit: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const connect = providerManifest({
  domain: "spotify_connect",
  name: "Spotify Connect",
  depends_on: "spotify",
});

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.getProviderName.mockReturnValue("Spotify");
});

describe("startAddProvider", () => {
  it("opens the setup flow of the provider", () => {
    const onStart = vi.fn();

    startAddProvider(providerManifest({ domain: "sonos" }), onStart);

    expect(onStart).toHaveBeenCalledOnce();
    expect(eventbusMock.emit.mock.calls).toEqual([
      ["setupFlowDialog", { kind: "provider", domain: "sonos" }],
    ]);
  });

  it("opens the setup flow once the provider it depends on is set up", () => {
    apiMock.getProvider.mockReturnValue({ instance_id: "spotify--a" });

    startAddProvider(connect);

    expect(apiMock.getProvider).toHaveBeenCalledWith("spotify");
    expect(eventbusMock.emit.mock.calls).toEqual([
      ["setupFlowDialog", { kind: "provider", domain: "spotify_connect" }],
    ]);
  });

  it("offers to set up the provider it depends on first", () => {
    const onStart = vi.fn();

    startAddProvider(connect, onStart);

    expect(eventbusMock.emit).toHaveBeenCalledOnce();
    const [event, request] = eventbusMock.emit.mock.calls[0] as [
      string,
      DeleteConfirmationDialogEvent,
    ];
    expect(event).toBe("deleteConfirmationDialog");
    expect(request.message).toBe("settings.provider_depends_on_confirm");
    // setting up another provider destroys nothing
    expect(request.destructive).toBe(false);
    expect(onStart).not.toHaveBeenCalled();

    request.onConfirm();

    expect(onStart).toHaveBeenCalledOnce();
    expect(eventbusMock.emit).toHaveBeenLastCalledWith("setupFlowDialog", {
      kind: "provider",
      domain: "spotify",
    });
  });
});
