import type { MusicQuizPlaybackOptions } from "@/composables/music-quiz/useMusicQuiz";
import type { Player } from "@/plugins/api/interfaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

const { mockSaveDeviceSetting, unmountCallbacks } = vi.hoisted(() => ({
  mockSaveDeviceSetting: vi.fn(),
  unmountCallbacks: [] as Array<() => void>,
}));

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onBeforeUnmount: (fn: () => void) => unmountCallbacks.push(fn),
  };
});

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    default: { players: reactive({}) },
  };
});

vi.mock("@/plugins/web_player", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const WebPlayerMode = {
    DISABLED: "disabled",
    SENDSPIN_ONLY: "sendspin_only",
  };
  return {
    WEB_PLAYER_ENABLED: "web_player_enabled",
    WebPlayerMode,
    isPlaybackMode: (mode: string) => mode === WebPlayerMode.SENDSPIN_ONLY,
    webPlayer: reactive({
      mode: WebPlayerMode.DISABLED,
      player_id: null as string | null,
    }),
  };
});

vi.mock("@/plugins/companion", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return { companionMode: ref(false) };
});

vi.mock("@/helpers/device_settings", () => ({
  saveDeviceSetting: mockSaveDeviceSetting,
}));

vi.mock("@/helpers/players", async () => {
  const { webPlayer } = await import("@/plugins/web_player");
  return {
    isBuiltinPlayer: (player: { player_id: string }) =>
      player.player_id === webPlayer.player_id,
  };
});

import { useMusicQuizThisDevice } from "@/composables/music-quiz/useMusicQuizThisDevice";
import api from "@/plugins/api";
import { companionMode } from "@/plugins/companion";
import { WebPlayerMode, webPlayer } from "@/plugins/web_player";

const LIVING_ROOM = { player_id: "living-room", name: "Living Room" };
const LAPTOP = { player_id: "laptop", name: "Marcel's Mac (Chrome)" };

describe("useMusicQuizThisDevice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    unmountCallbacks.splice(0).forEach((callback) => callback());
    vi.useRealTimers();
    vi.clearAllMocks();
    webPlayer.mode = WebPlayerMode.DISABLED;
    webPlayer.player_id = null;
    companionMode.value = false;
    for (const playerId of Object.keys(api.players)) {
      delete api.players[playerId];
    }
  });

  it("finds the web player of this browser among the venue players", () => {
    enableWebPlayer();
    const { thisDevicePlayerId, canPlayOnThisDevice } = create([
      LIVING_ROOM,
      LAPTOP,
    ]);

    expect(thisDevicePlayerId.value).toBe("laptop");
    expect(canPlayOnThisDevice.value).toBe(false);
  });

  it("offers this device only while the web player is off", () => {
    const { canPlayOnThisDevice } = create([LIVING_ROOM]);
    expect(canPlayOnThisDevice.value).toBe(true);

    webPlayer.mode = WebPlayerMode.SENDSPIN_ONLY;
    expect(canPlayOnThisDevice.value).toBe(false);
  });

  it("leaves the companion app's own player alone", () => {
    companionMode.value = true;
    const { canPlayOnThisDevice } = create([LIVING_ROOM]);

    expect(canPlayOnThisDevice.value).toBe(false);
  });

  it("turns on the web player, refreshes once it is online and selects it", async () => {
    const { options, refresh, select, connecting, playOnThisDevice } = create([
      LIVING_ROOM,
    ]);

    playOnThisDevice();
    expect(mockSaveDeviceSetting).toHaveBeenCalledWith(
      "web_player_enabled",
      "true",
    );
    expect(connecting.value).toBe(true);

    enableWebPlayer();
    await nextTick();
    expect(refresh).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();

    options.value = { ...options.value, venue_players: [LIVING_ROOM, LAPTOP] };
    await nextTick();
    expect(select).toHaveBeenCalledWith("laptop");
    expect(connecting.value).toBe(false);
  });

  it("stops waiting quietly when the web player never becomes a venue player", async () => {
    const { options, refresh, select, connecting, playOnThisDevice } = create([
      LIVING_ROOM,
    ]);

    playOnThisDevice();
    enableWebPlayer();
    await nextTick();
    vi.runAllTimers();
    expect(connecting.value).toBe(false);

    options.value = { ...options.value, venue_players: [LIVING_ROOM, LAPTOP] };
    await nextTick();
    expect(refresh).toHaveBeenCalledOnce();
    expect(select).not.toHaveBeenCalled();
  });

  it("stops waiting when the host picks another player", async () => {
    const {
      options,
      refresh,
      select,
      connecting,
      playOnThisDevice,
      cancelPlayOnThisDevice,
    } = create([LIVING_ROOM]);

    playOnThisDevice();
    cancelPlayOnThisDevice();
    expect(connecting.value).toBe(false);

    enableWebPlayer();
    options.value = { ...options.value, venue_players: [LIVING_ROOM, LAPTOP] };
    await nextTick();
    expect(refresh).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });
});

function create(venuePlayers: MusicQuizPlaybackOptions["venue_players"]) {
  const options = ref<MusicQuizPlaybackOptions>({
    default_playback_mode: "venue",
    default_venue_player_id: venuePlayers[0]?.player_id ?? null,
    venue_available: venuePlayers.length > 0,
    remote_available: true,
    venue_players: venuePlayers,
  });
  const refresh = vi.fn();
  const select = vi.fn();
  return {
    options,
    refresh,
    select,
    ...useMusicQuizThisDevice(() => options.value, { refresh, select }),
  };
}

function enableWebPlayer() {
  webPlayer.mode = WebPlayerMode.SENDSPIN_ONLY;
  webPlayer.player_id = LAPTOP.player_id;
  api.players[LAPTOP.player_id] = {
    player_id: LAPTOP.player_id,
    available: true,
  } as Player;
}
