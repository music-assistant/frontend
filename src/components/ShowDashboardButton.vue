<template>
  <DropdownMenu v-if="chromecastAvailable" v-model:open="open">
    <DropdownMenuTrigger as-child>
      <Button
        :variant="variant"
        :size="buttonSize"
        :class="activeSession ? activePillClass : ''"
        :aria-label="$t('tooltip.show_dashboard')"
        :title="$t('tooltip.show_dashboard')"
        @click="loadDevices"
      >
        <TvMinimal :size="iconSize" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" :class="contentClass">
      <div
        v-if="loading"
        class="text-muted-foreground px-2 py-1.5 text-sm"
        data-testid="cast-dashboard-loading"
      >
        {{ $t("dashboard.loading") }}
      </div>
      <div
        v-else-if="!devices.length"
        class="text-muted-foreground px-2 py-1.5 text-sm"
        data-testid="cast-dashboard-empty"
      >
        {{ $t("dashboard.no_devices") }}
      </div>
      <DropdownMenuItem
        v-for="device in devices"
        :key="device.device_id"
        data-testid="cast-dashboard-device"
        @click="selectDevice(device)"
      >
        <div class="flex min-w-0 items-center gap-1.5">
          <ProviderIcon
            v-if="deviceHasProvider(device)"
            class="shrink-0"
            :domain="device.provider_instance"
            :size="14"
          />
          <div class="flex min-w-0 flex-col">
            <span class="truncate">{{ device.name }}</span>
            <span
              v-if="isPlayingAudio(device)"
              class="text-muted-foreground truncate text-xs"
            >
              {{ $t("dashboard.playing_hint") }}
            </span>
          </div>
        </div>
        <Check v-if="isActiveDevice(device)" class="ml-auto size-4" />
      </DropdownMenuItem>
      <template v-if="activeSession">
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          data-testid="cast-dashboard-disconnect"
          @click="disconnect"
        >
          <Unplug />
          <span>{{ $t("dashboard.disconnect") }}</span>
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, type ButtonVariants } from "@/components/ui/button";
import ProviderIcon from "@/components/ProviderIcon.vue";
import api from "@/plugins/api";
import {
  type DashboardDevice,
  type DashboardSession,
  type EventMessage,
  EventType,
  PlaybackState,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Check, TvMinimal, Unplug } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

const props = withDefaults(
  defineProps<{
    path: string;
    variant?: ButtonVariants["variant"];
    buttonSize?: ButtonVariants["size"];
    iconSize?: number;
    // z-index override for hosts that render inside a high z-index overlay
    contentClass?: string;
  }>(),
  {
    variant: "ghost-icon",
    buttonSize: "icon-sm",
    iconSize: 13,
    contentClass: undefined,
  },
);

const open = ref(false);
const loading = ref(false);
const devices = ref<DashboardDevice[]>([]);
const sessions = ref<DashboardSession[]>([]);

// Chromecast dashboards can't be cast from a dashboard viewer session itself,
// and the button only makes sense while the chromecast provider is loaded.
const chromecastAvailable = computed(
  () =>
    !authManager.isDashboardViewer?.() &&
    Object.values(api.providers ?? {}).some(
      (provider) => provider.domain === "chromecast" && provider.available,
    ),
);

// Solid primary pill for the active state, same treatment as the
// autoplay/crossfade toggles on the fullscreen player header.
const activePillClass =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:bg-primary dark:hover:bg-primary/90";

// The session (if any) currently showing this button's own dashboard route.
const activeSession = computed(() =>
  sessions.value.find((session) => session.path === props.path),
);

onMounted(() => {
  if (!chromecastAvailable.value) return;
  fetchSessions();
  const unsubscribe = api.subscribe(
    EventType.DASHBOARD_SESSIONS_UPDATED,
    (evt: EventMessage) => {
      sessions.value = evt.data as DashboardSession[];
    },
  );
  onBeforeUnmount(unsubscribe);
});

async function fetchSessions() {
  try {
    sessions.value =
      await api.sendCommand<DashboardSession[]>("dashboard/sessions");
  } catch (error) {
    console.error("Failed to load dashboard sessions:", error);
  }
}

async function loadDevices() {
  loading.value = true;
  try {
    devices.value =
      await api.sendCommand<DashboardDevice[]>("dashboard/devices");
  } catch (error) {
    console.error("Failed to load cast devices:", error);
    devices.value = [];
  } finally {
    loading.value = false;
  }
}

async function selectDevice(device: DashboardDevice) {
  open.value = false;
  if (isActiveDevice(device)) return; // already showing here

  const previousSession = activeSession.value;
  if (previousSession) {
    try {
      await api.sendCommand("dashboard/hide", {
        provider_instance: previousSession.provider_instance,
        device_id: previousSession.device_id,
      });
    } catch (error) {
      // Still attempt to show on the newly selected device even if stopping
      // the previous session failed.
      console.error("Failed to stop previous cast dashboard:", error);
    }
  }

  try {
    await api.sendCommand("dashboard/show", {
      provider_instance: device.provider_instance,
      device_id: device.device_id,
      path: props.path,
    });
    toast.success($t("dashboard.started", [device.name]));
  } catch (error) {
    // The global sendCommand error handler already surfaces the server's
    // message (e.g. remote access disabled) via a toast.
    console.error("Failed to start cast dashboard:", error);
  }
}

async function disconnect() {
  open.value = false;
  const session = activeSession.value;
  if (!session) return;

  // Optimistically clear locally; dashboard_sessions_updated confirms it.
  sessions.value = sessions.value.filter((s) => s !== session);
  try {
    await api.sendCommand("dashboard/hide", {
      provider_instance: session.provider_instance,
      device_id: session.device_id,
    });
  } catch (error) {
    console.error("Failed to stop cast dashboard:", error);
  }
}

// ProviderIcon resolves an instance id to its provider's icon itself, so this
// only needs to gate rendering when the instance isn't (or no longer) loaded.
function deviceHasProvider(device: DashboardDevice): boolean {
  return !!api.providers?.[device.provider_instance];
}

function isPlayingAudio(device: DashboardDevice): boolean {
  if (!device.player_id) return false;
  return (
    api.players?.[device.player_id]?.playback_state === PlaybackState.PLAYING
  );
}

function isActiveDevice(device: DashboardDevice): boolean {
  const session = activeSession.value;
  return (
    !!session &&
    session.device_id === device.device_id &&
    session.provider_instance === device.provider_instance
  );
}
</script>
