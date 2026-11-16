import { confirmProviderRemoval } from "@/helpers/provider_removal";
import { ProviderType } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../fixtures/providerConfig";

const { eventbusMock } = vi.hoisted(() => ({
  eventbusMock: {
    emit: vi.fn(),
  },
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

// returns the key and its arguments, so both are assertable from the payload
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: string[]) =>
    args ? `${key}:${args.join(",")}` : key,
}));

function emittedPayload() {
  const call = eventbusMock.emit.mock.calls.find(
    ([event]) => event === "deleteConfirmationDialog",
  );
  if (!call) throw new Error("deleteConfirmationDialog was not emitted");
  return call[1];
}

describe("confirmProviderRemoval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("warns that a music source takes its library items along", () => {
    confirmProviderRemoval(
      providerConfig({ type: ProviderType.MUSIC }),
      "My Spotify",
      vi.fn(),
    );

    expect(emittedPayload()).toMatchObject({
      title: "settings.remove_provider",
      message: "settings.remove_provider_confirm_music:My Spotify",
      confirmLabel: "settings.remove_provider",
      acknowledgement: "settings.remove_provider_acknowledge",
    });
  });

  it("warns that a player provider takes its players along", () => {
    confirmProviderRemoval(
      providerConfig({ type: ProviderType.PLAYER }),
      "Sonos",
      vi.fn(),
    );

    const payload = emittedPayload();
    expect(payload.message).toBe(
      "settings.remove_provider_confirm_player:Sonos",
    );
    expect(payload.acknowledgement).toBeUndefined();
  });

  it.each([ProviderType.METADATA, ProviderType.PLUGIN])(
    "uses the generic message for a %s provider",
    (type) => {
      confirmProviderRemoval(providerConfig({ type }), "Other", vi.fn());

      const payload = emittedPayload();
      expect(payload.message).toBe("settings.remove_provider_confirm:Other");
      expect(payload.acknowledgement).toBeUndefined();
    },
  );

  it("hands the confirm callback to the dialog", () => {
    const onConfirm = vi.fn();

    confirmProviderRemoval(providerConfig(), "My Spotify", onConfirm);

    expect(emittedPayload().onConfirm).toBe(onConfirm);
  });
});
