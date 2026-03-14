<template>
  <section class="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
    <header class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">AI Radio</h1>
        <p class="text-sm text-muted-foreground">
          Run configured AI Radio stations directly from the Music Assistant frontend.
        </p>
      </div>
      <Button variant="outline" :disabled="refreshing" @click="handleRefresh">
        {{ refreshing ? "Refreshing..." : "Refresh" }}
      </Button>
    </header>

    <div class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Start Run</CardTitle>
          <CardDescription>
            Select a station, then start playlist generation or live queue injection.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="ai-radio-station">Station</Label>
            <Select
              :model-value="selectedStationId"
              @update:model-value="(value) => onSelectStation(value as string)"
            >
              <SelectTrigger id="ai-radio-station" class="w-full">
                <SelectValue placeholder="Select station" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="station in stations"
                  :key="station.id"
                  :value="station.id"
                >
                  {{ station.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label for="ai-radio-player">Playback Device Override (optional)</Label>
            <Select
              :model-value="selectedPlayerSelectValue"
              @update:model-value="(value) => onSelectPlayer(value as string)"
            >
              <SelectTrigger id="ai-radio-player" class="w-full">
                <SelectValue placeholder="Use station default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="DEFAULT_PLAYER_SELECT_VALUE">
                  Use station default
                </SelectItem>
                <SelectItem
                  v-for="player in availablePlayers"
                  :key="player.player_id"
                  :value="player.player_id"
                >
                  {{ player.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="grid gap-2 sm:grid-cols-2">
            <Button
              :disabled="!selectedStationId || startingRun"
              @click="startPlaylist"
            >
              {{ startingRun ? "Starting..." : "Create Playlist" }}
            </Button>
            <Button
              variant="secondary"
              :disabled="!selectedStationId || startingRun"
              @click="startDynamic"
            >
              {{ startingRun ? "Starting..." : "Start Live Radio" }}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Latest AI Radio sessions for this server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div v-if="sessions.length === 0" class="text-sm text-muted-foreground">
            No sessions yet.
          </div>
          <ul v-else class="space-y-3">
            <li
              v-for="session in sessions"
              :key="session.session_id"
              class="rounded-md border p-3"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ stationName(session.station_id) }}</span>
                <Badge :variant="badgeVariant(session.status)">
                  {{ session.status }}
                </Badge>
                <Badge variant="outline">{{ session.mode }}</Badge>
              </div>
              <div class="mt-2 text-xs text-muted-foreground">
                Started: {{ formatTimestamp(session.started_at || session.created_at) }}
              </div>
              <div v-if="session.error" class="mt-2 text-sm text-destructive">
                {{ session.error }}
              </div>
              <div v-if="session.status === 'running'" class="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="stoppingRun"
                  @click="stopSession(session.session_id)"
                >
                  {{ stoppingRun ? "Stopping..." : "Stop" }}
                </Button>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAiRadio } from "@/composables/useAiRadio";
import api from "@/plugins/api";
import type { AIRadioSession, Player } from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const DEFAULT_PLAYER_SELECT_VALUE = "__station_default__";
const AUTO_REFRESH_MS = 5000;

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const {
  stations,
  sessions,
  loadingStations,
  loadingStatus,
  startingRun,
  stoppingRun,
  startRun,
  stopRun,
  refreshAll,
} = useAiRadio();

const selectedStationId = ref("");
const selectedPlayerId = ref("");
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const refreshing = computed(() => loadingStations.value || loadingStatus.value);

const selectedPlayerSelectValue = computed(() => {
  return selectedPlayerId.value || DEFAULT_PLAYER_SELECT_VALUE;
});

const availablePlayers = computed<Player[]>(() => {
  return Object.values(api.players)
    .filter((player) => player.available !== false)
    .sort((a, b) => a.name.localeCompare(b.name));
});

const stationById = computed(() => {
  const map = new Map<string, string>();
  for (const station of stations.value) {
    map.set(station.id, station.name);
  }
  return map;
});

const stationName = (stationId: string) => {
  return stationById.value.get(stationId) || stationId;
};

const badgeVariant = (status: AIRadioSession["status"]): BadgeVariant => {
  if (status === "running") return "default";
  if (status === "completed") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
};

const formatTimestamp = (value?: string) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const onSelectStation = (stationId: string) => {
  selectedStationId.value = stationId;
  const station = stations.value.find((item) => item.id === stationId);
  selectedPlayerId.value = station?.default_player_id || "";
};

const onSelectPlayer = (value: string) => {
  selectedPlayerId.value =
    value === DEFAULT_PLAYER_SELECT_VALUE ? "" : value;
};

const handleRefresh = async () => {
  await refreshAll();
};

const startPlaylist = async () => {
  if (!selectedStationId.value) return;
  await startRun(selectedStationId.value, "playlist");
};

const startDynamic = async () => {
  if (!selectedStationId.value) return;
  await startRun(
    selectedStationId.value,
    "dynamic",
    selectedPlayerId.value || undefined,
  );
};

const stopSession = async (sessionId: string) => {
  await stopRun(sessionId);
};

onMounted(async () => {
  await refreshAll(true);
  if (stations.value.length > 0) {
    onSelectStation(stations.value[0].id);
  }
  refreshTimer = setInterval(() => {
    void refreshAll(true).catch(() => undefined);
  }, AUTO_REFRESH_MS);
});

onBeforeUnmount(() => {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
});
</script>
