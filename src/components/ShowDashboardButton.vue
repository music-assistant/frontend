<template>
  <DropdownMenu v-if="showButton" v-model:open="open">
    <DropdownMenuTrigger as-child>
      <Button
        :variant="variant"
        :size="buttonSize"
        :class="activeSession ? activePillClass : ''"
        :aria-label="$t('tooltip.show_dashboard')"
        :title="$t('tooltip.show_dashboard')"
        @click="loadDashboards"
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
        v-else-if="!dashboards.length"
        class="text-muted-foreground px-2 py-1.5 text-sm"
        data-testid="cast-dashboard-empty"
      >
        {{ $t("dashboard.no_devices") }}
      </div>
      <DropdownMenuItem
        v-for="device in dashboards"
        :key="device.dashboard_id"
        data-testid="cast-dashboard-device"
        @click="selectDevice(device)"
      >
        <div class="flex min-w-0 items-center gap-1.5">
          <DashboardDeviceIcon
            :provider-domain-hint="device.provider_domain_hint"
            :size="14"
          />
          <span class="truncate">{{ device.name }}</span>
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
          <span>{{ $t("dashboard.disconnect", [activeSession.name]) }}</span>
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
import DashboardDeviceIcon from "@/components/DashboardDeviceIcon.vue";
import api from "@/plugins/api";
import { waitForApiInitialization } from "@/plugins/api/helpers";
import {
  type DashboardDevice,
  type DashboardSession,
  type DashboardType,
  type EventMessage,
  EventType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Check, TvMinimal, Unplug } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

const props = withDefaults(
  defineProps<{
    dashboard: DashboardType;
    playerId?: string;
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
const dashboards = ref<DashboardDevice[]>([]);
const sessions = ref<DashboardSession[]>([]);

// A dashboard viewer can't cast a dashboard itself; only show once one is registered.
const showButton = computed(
  () => !authManager.isDashboardViewer?.() && dashboards.value.length > 0,
);

// Solid primary pill for the active state, matching the fullscreen player header's autoplay/crossfade toggles.
const activePillClass =
  "border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:bg-primary dark:hover:bg-primary/90";

// Session (if any) showing this dashboard; now_playing also requires a matching player_id.
const activeSession = computed(() =>
  sessions.value.find(
    (session) =>
      session.dashboard === props.dashboard &&
      (props.dashboard !== "now_playing" ||
        session.player_id === props.playerId),
  ),
);

// Wait for API init (mount can race a hard page refresh) before fetching lists/subscribing.
let active = false;
const unsubscribers: Array<() => void> = [];

onMounted(async () => {
  active = true;
  await waitForApiInitialization();
  if (!active) return;

  fetchSessions();
  loadDashboards();
  unsubscribers.push(
    api.subscribe(EventType.DASHBOARD_SESSIONS_UPDATED, (evt: EventMessage) => {
      sessions.value = evt.data as DashboardSession[];
    }),
    // Keep the list live - clients connect/disconnect, and it also drives this button's visibility.
    api.subscribe(EventType.DASHBOARDS_UPDATED, () => loadDashboards()),
  );
});

onBeforeUnmount(() => {
  active = false;
  unsubscribers.forEach((unsubscribe) => unsubscribe());
});

async function fetchSessions() {
  try {
    sessions.value =
      await api.sendCommand<DashboardSession[]>("dashboard/sessions");
  } catch (error) {
    console.error("Failed to load dashboard sessions:", error);
  }
}

async function loadDashboards() {
  loading.value = true;
  // Refresh sessions too so checkmarks recover from any missed events (e.g. a websocket reconnect).
  fetchSessions();
  try {
    dashboards.value = await api.sendCommand<DashboardDevice[]>(
      "dashboard/dashboards",
      { dashboard: props.dashboard },
    );
  } catch (error) {
    console.error("Failed to load cast dashboards:", error);
    dashboards.value = [];
  } finally {
    loading.value = false;
  }
}

async function selectDevice(device: DashboardDevice) {
  open.value = false;
  if (isActiveDevice(device)) return;

  const previousSession = activeSession.value;
  if (previousSession) {
    try {
      await api.sendCommand("dashboard/hide", {
        dashboard_id: previousSession.dashboard_id,
      });
    } catch (error) {
      // Still try the new device even if stopping the old one failed.
      console.error("Failed to stop previous cast dashboard:", error);
    }
  }

  try {
    await api.sendCommand("dashboard/show", {
      dashboard_id: device.dashboard_id,
      dashboard: props.dashboard,
      player_id: props.playerId ?? null,
    });
    toast.success($t("dashboard.started", [device.name]));
  } catch (error) {
    // Global sendCommand error handler already toasts the server's message.
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
      dashboard_id: session.dashboard_id,
    });
  } catch (error) {
    console.error("Failed to stop cast dashboard:", error);
    await fetchSessions(); // roll back the optimistic removal
  }
}

function isActiveDevice(device: DashboardDevice): boolean {
  const session = activeSession.value;
  return !!session && session.dashboard_id === device.dashboard_id;
}
</script>
