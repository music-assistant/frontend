import { useMultiChannelCandidates } from "@/composables/settings/players/useMultiChannelCandidates";
import {
  type Player,
  type PlayerProtocolInfo,
  ProtocolRole,
  ProviderFeature,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, ref, type EffectScope } from "vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getMultiChannelCandidates: vi.fn(),
    getProvider: vi.fn(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

describe("useMultiChannelCandidates", () => {
  let scope: EffectScope;

  beforeEach(() => {
    vi.clearAllMocks();
    scope = effectScope();
    // the Sendspin provider combines speakers, the AirPlay provider does not
    apiMock.getProvider.mockImplementation((instanceId: string) => ({
      supported_features:
        instanceId === "sendspin"
          ? [ProviderFeature.CREATE_MULTI_CHANNEL_PLAYER]
          : [],
    }));
    apiMock.getMultiChannelCandidates.mockResolvedValue(["studio-left"]);
  });

  afterEach(() => scope.stop());

  it("fetches the list of each provider of the player that combines speakers, quietly", async () => {
    const candidates = useCandidates(speaker());
    await flushPromises();

    expect(apiMock.getMultiChannelCandidates).toHaveBeenCalledOnce();
    expect(apiMock.getMultiChannelCandidates).toHaveBeenCalledWith("sendspin", {
      suppressGlobalError: true,
    });
    expect(candidates.value).toEqual({ sendspin: ["studio-left"] });
  });

  it("fetches again when the player comes back, not when anything else changes", async () => {
    const player = ref<Player | undefined>(speaker({ available: false }));
    scope.run(() => useMultiChannelCandidates(player));
    await flushPromises();

    player.value = speaker({ available: false, volume_level: 30 });
    await flushPromises();
    expect(apiMock.getMultiChannelCandidates).toHaveBeenCalledOnce();

    player.value = speaker();
    await flushPromises();
    expect(apiMock.getMultiChannelCandidates).toHaveBeenCalledTimes(2);
  });

  it("lists no candidates for a provider whose list does not load", async () => {
    apiMock.getMultiChannelCandidates.mockRejectedValueOnce(
      new Error("Unknown command"),
    );

    const candidates = useCandidates(speaker());
    await flushPromises();

    expect(candidates.value).toEqual({ sendspin: [] });
  });

  it("keeps the list of the player that shows when an earlier one answers late", async () => {
    let answerFirst: (ids: string[]) => void = () => undefined;
    apiMock.getMultiChannelCandidates
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce(["studio-right"]);
    const player = ref<Player | undefined>(speaker());
    const candidates = scope.run(() => useMultiChannelCandidates(player))!;

    player.value = speaker({ player_id: "studio-right" });
    await flushPromises();
    answerFirst(["studio-left"]);
    await flushPromises();

    expect(candidates.value).toEqual({ sendspin: ["studio-right"] });
  });

  function useCandidates(player: Player) {
    return scope.run(() => useMultiChannelCandidates(ref(player)))!;
  }
});

function speaker(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "studio-left",
    available: true,
    protocols: [protocol("sendspin"), protocol("airplay")],
    ...overrides,
  } as Player;
}

function protocol(domain: string): PlayerProtocolInfo {
  return {
    protocol_id: `${domain}-id`,
    domain,
    provider: domain,
    role: ProtocolRole.NATIVE,
    available: true,
    active: false,
  };
}
