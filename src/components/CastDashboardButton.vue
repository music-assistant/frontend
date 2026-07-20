<template>
  <DropdownMenu v-if="chromecastAvailable" v-model:open="open">
    <DropdownMenuTrigger as-child>
      <Button
        :variant="variant"
        :size="buttonSize"
        :aria-label="$t('tooltip.cast_dashboard')"
        :title="$t('tooltip.cast_dashboard')"
        @click="loadDevices"
      >
        <TvMinimal :size="iconSize" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <div
        v-if="loading"
        class="text-muted-foreground px-2 py-1.5 text-sm"
        data-testid="cast-dashboard-loading"
      >
        {{ $t("cast_dashboard.loading") }}
      </div>
      <div
        v-else-if="!devices.length"
        class="text-muted-foreground px-2 py-1.5 text-sm"
        data-testid="cast-dashboard-empty"
      >
        {{ $t("cast_dashboard.no_devices") }}
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
              {{ $t("cast_dashboard.playing_hint") }}
            </span>
          </div>
        </div>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button, type ButtonVariants } from "@/components/ui/button";
import ProviderIcon from "@/components/ProviderIcon.vue";
import api from "@/plugins/api";
import { type DashboardDevice, PlaybackState } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { TvMinimal } from "@lucide/vue";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

const props = withDefaults(
  defineProps<{
    path: string;
    variant?: ButtonVariants["variant"];
    buttonSize?: ButtonVariants["size"];
    iconSize?: number;
  }>(),
  {
    variant: "ghost-icon",
    buttonSize: "icon-sm",
    iconSize: 13,
  },
);

const open = ref(false);
const loading = ref(false);
const devices = ref<DashboardDevice[]>([]);

// Chromecast dashboards can't be cast from a cast viewer session itself, and
// the button only makes sense while the chromecast provider is loaded.
const chromecastAvailable = computed(
  () =>
    !authManager.isCastViewer?.() &&
    Object.values(api.providers ?? {}).some(
      (provider) => provider.domain === "chromecast" && provider.available,
    ),
);

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
  try {
    await api.sendCommand("dashboard/show", {
      provider_instance: device.provider_instance,
      device_id: device.device_id,
      path: props.path,
    });
    toast.success($t("cast_dashboard.started", [device.name]));
  } catch (error) {
    // The global sendCommand error handler already surfaces the server's
    // message (e.g. remote access disabled) via a toast.
    console.error("Failed to start cast dashboard:", error);
  }
}
</script>
