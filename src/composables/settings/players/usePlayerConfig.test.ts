import { usePlayerConfig } from "@/composables/settings/players/usePlayerConfig";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import { EventType, type PlayerConfig } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { playerSettingsConfig } from "../../../../tests/fixtures/playerSettingsConfig";

const { apiMock, isPlayerBeingRemoved } = vi.hoisted(() => ({
  apiMock: {
    getPlayerConfig: vi.fn<MusicAssistantApi["getPlayerConfig"]>(),
    players: {} as Record<string, unknown>,
    savePlayerConfig: vi.fn<MusicAssistantApi["savePlayerConfig"]>(),
    subscribe: vi.fn(),
  },
  isPlayerBeingRemoved: vi.fn<(playerId: string) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/helpers/player_settings_actions", () => ({ isPlayerBeingRemoved }));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const form = { discardChanges: vi.fn(), saveFailed: vi.fn() };

describe("usePlayerConfig", () => {
  // the api mock is a module singleton, so a host left mounted keeps answering
  // the next test's events
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.subscribe.mockReturnValue(vi.fn());
    apiMock.getPlayerConfig.mockResolvedValue(playerSettingsConfig());
    apiMock.players = { kitchen: { player_id: "kitchen" } };
    isPlayerBeingRemoved.mockReturnValue(false);
  });

  it("loads the config of the player", async () => {
    const { config } = await usePlayerConfigOf();

    expect(apiMock.getPlayerConfig).toHaveBeenCalledWith("kitchen");
    expect(config.value?.player_id).toBe("kitchen");
  });

  it("keeps the edits that wait for a save when the server reports a change", async () => {
    const { config } = await usePlayerConfigOf();
    config.value!.values.auto_play.value = true;
    apiMock.getPlayerConfig.mockResolvedValueOnce(
      playerSettingsConfig({ name: "Kitchen speaker" }),
    );

    deliver(EventType.PLAYER_CONFIG_UPDATED, "kitchen");
    await flushPromises();

    expect(config.value?.name).toBe("Kitchen speaker");
    expect(config.value?.values.auto_play.value).toBe(true);
  });

  it("takes what an immediate apply stored, and keeps the other edits", async () => {
    const { config, onImmediateApply } = await usePlayerConfigOf();
    config.value!.values.auto_play.value = true;
    config.value!.values.max_volume.value = 80;
    apiMock.savePlayerConfig.mockResolvedValueOnce(withValue("max_volume", 75));

    void onImmediateApply({ max_volume: 80 });
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      max_volume: 80,
    });
    expect(config.value?.values.max_volume.value).toBe(75);
    expect(config.value?.values.auto_play.value).toBe(true);
  });

  it("saves the values as given and says the save landed", async () => {
    apiMock.savePlayerConfig.mockResolvedValueOnce(playerSettingsConfig());
    const { save } = await usePlayerConfigOf();

    expect(await save({ auto_play: true })).toBe(true);
    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      auto_play: true,
    });
    expect(form.saveFailed).not.toHaveBeenCalled();
  });

  it("keeps a refused save guarded on the form", async () => {
    apiMock.savePlayerConfig.mockRejectedValueOnce(
      new ApiCommandError("Refused", 1, "Refused"),
    );
    const { save, loading } = await usePlayerConfigOf();

    expect(await save({ auto_play: true })).toBe(false);
    expect(form.saveFailed).toHaveBeenCalledOnce();
    expect(loading.value).toBe(false);
  });

  it("reports the player the server removed, and asks no config of it", async () => {
    const onRemoved = vi.fn();
    await usePlayerConfigOf({ onRemoved });

    deliver(EventType.PLAYER_REMOVED, "attic");
    expect(onRemoved).not.toHaveBeenCalled();

    delete apiMock.players.kitchen;
    deliver(EventType.PLAYER_REMOVED, "kitchen");
    deliver(EventType.PLAYER_CONFIG_UPDATED, "kitchen");
    await flushPromises();

    expect(onRemoved).toHaveBeenCalledOnce();
    expect(apiMock.getPlayerConfig).toHaveBeenCalledOnce();
  });

  it("leaves a player a command of this app removes to that command", async () => {
    const onRemoved = vi.fn();
    await usePlayerConfigOf({ onRemoved });
    isPlayerBeingRemoved.mockImplementation((id) => id === "kitchen");

    deliver(EventType.PLAYER_REMOVED, "kitchen");

    expect(onRemoved).not.toHaveBeenCalled();
  });
});

function withValue(key: string, value: number): PlayerConfig {
  const config = playerSettingsConfig();
  config.values[key].value = value;
  return config;
}

/**
 * Deliver an event the composable listens for.
 */
function deliver(eventType: EventType, objectId: string) {
  for (const [subscribed, callback] of apiMock.subscribe.mock.calls) {
    if (subscribed === eventType) callback({ object_id: objectId });
  }
}

async function usePlayerConfigOf(
  options: Parameters<typeof usePlayerConfig>[2] = {},
) {
  let result!: ReturnType<typeof usePlayerConfig>;
  mount(
    defineComponent({
      setup() {
        result = usePlayerConfig(() => "kitchen", ref(form), options);
        return () => null;
      },
    }),
  );
  await flushPromises();
  return result;
}
