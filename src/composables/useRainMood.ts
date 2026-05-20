import { reactive } from "vue";
import api from "@/plugins/api";

// Module-level singleton so state is shared across all consumers.
const state = reactive<Record<string, boolean>>({});

export function isRainMoodAvailable(): boolean {
  return Object.values(api.providers).some((p) => p.domain === "rain_mood");
}

export function isRainActive(playerId: string): boolean {
  return state[playerId] ?? false;
}

export async function fetchRainStatus(playerId: string): Promise<void> {
  try {
    const result = await api.sendCommand<{ active: boolean }>(
      "rain_mood/status",
      { player_id: playerId },
    );
    state[playerId] = result.active;
  } catch {
    state[playerId] = false;
  }
}

export async function enableRain(playerId: string): Promise<void> {
  const result = await api.sendCommand<{ active: boolean }>(
    "rain_mood/enable",
    { player_id: playerId },
  );
  state[playerId] = result.active;
}

export async function disableRain(playerId: string): Promise<void> {
  const result = await api.sendCommand<{ active: boolean }>(
    "rain_mood/disable",
    { player_id: playerId },
  );
  state[playerId] = result.active;
}
