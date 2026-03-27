<template>
  <div
    class="panel-item"
    :class="{
      'panel-item-selected': player.player_id == store.activePlayerId,
      'panel-item-idle': player.playback_state == PlaybackState.IDLE,
      'panel-item-off': player.powered == false,
      'opacity-50 pointer-events-none': !player.available,
    }"
    @click="$emit('click', player)"
  >
    <!-- now playing media -->
    <div class="panel-item-details flex items-center">
      <!-- prepend: media thumb -->
      <div class="player-media-thumb mr-2.5 shrink-0">
        <!-- current media image -->
        <div
          v-if="player.powered != false && player.current_media?.image_url"
        >
          <img
            class="media-thumb"
            :src="getMediaImageUrl(player.current_media.image_url)"
          />
        </div>
        <!-- fallback: display player icon -->
        <div v-else class="icon-thumb">
          <component
            :is="resolvedPlayerIcon"
            class="h-6 w-6 opacity-80"
          />
        </div>
      </div>

      <!-- content area -->
      <div class="flex-1 min-w-0">
      <!-- playername -->
        <!-- special builtin player (web player or companion native player) -->
        <div
          v-if="isBuiltinPlayer(player)"
          class="flex items-center"
          style="font-size: 0.88rem; line-height: 1.3"
        >
          <span class="truncate">{{ getPlayerName(player, 12) }}</span>
          <!-- append small icon to the title -->
          <Badge variant="outline" class="ml-2 text-xs">
            <Smartphone
              v-if="store.deviceType == 'phone'"
              class="h-3.5 w-3.5"
            />
            <Monitor
              v-else
              class="h-3.5 w-3.5"
            />
            <span v-if="store.deviceType != 'phone'" style="margin-left: 6px">{{
              $t("this_device")
            }}</span>
          </Badge>
        </div>
        <!-- regular player -->
        <div v-else class="truncate" style="font-size: 0.88rem; line-height: 1.3">
          {{ getPlayerName(player, 27) }}
        </div>

      <!-- subtitle: media item title -->
        <div
          v-if="player.powered != false"
          style="
            font-size: 0.8rem;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.3;
          "
        >
          <div v-if="player.current_media?.title" class="truncate">
            {{ player.current_media.title }}
          </div>
        </div>

      <!-- subtitle -->
        <div
          class="text-muted-foreground"
          style="font-size: 0.78rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3"
        >
          <!-- player powered off -->
          <div v-if="player.powered == false">
            {{ $t("off") }}
          </div>
          <!-- artist + album -->
          <div
            v-else-if="
              player.current_media?.artist && player.current_media?.album
            "
            class="truncate"
          >
            {{ player.current_media.artist }} •
            {{ player.current_media.album }}
          </div>
          <!-- artist only -->
          <div v-else-if="player.current_media?.artist" class="truncate">
            {{ player.current_media.artist }}
          </div>
          <!-- album only -->
          <div v-else-if="player.current_media?.album" class="truncate">
            {{ player.current_media.album }}
          </div>
          <!-- queue empty message -->
          <div v-else-if="playerQueue?.items == 0">
            {{ $t("queue_empty") }}
          </div>
        </div>
      </div>

      <!-- power/play/pause + menu button -->
      <div class="flex items-center shrink-0 ml-1">
        <!-- power button -->
        <Button
          v-if="
            player.power_control != PLAYER_CONTROL_NONE && allowPowerControl
          "
          variant="ghost-icon"
          size="icon"
          class="player-command-btn"
          @click.stop="
            api.playerCommandPowerToggle(player.player_id);
            store.activePlayerId = player.player_id;
          "
        >
          <Power
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? 30 : 32"
          />
        </Button>

        <!-- group members button -->
        <Button
          v-if="
            showSyncControls &&
            player.can_group_with.length > 0 &&
            showVolumeControl
          "
          variant="ghost-icon"
          size="icon"
          class="player-command-btn group-expand-btn"
          @click.stop="$emit('toggle-expand', player)"
        >
          <span class="relative inline-flex group-badge">
            <Speaker
              :size="getBreakpointValue({ breakpoint: 'phone' }) ? 24 : 26"
            />
            <span class="absolute -top-1.5 -right-1.5 h-3.5 min-w-3.5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center px-1">
              {{
                player.type == PlayerType.GROUP
                  ? player.group_members.length
                  : player.group_members.length || 1
              }}
            </span>
          </span>
        </Button>

        <!-- play/pause button -->
        <Button
          v-if="canPlayPause"
          variant="ghost-icon"
          size="icon"
          class="player-command-btn"
          :disabled="
            api.queues[player.player_id]?.extra_attributes
              ?.play_action_in_progress === true
          "
          @click.stop="
            api.playerCommandPlayPause(player.player_id);
            store.activePlayerId = player.player_id;
          "
        >
          <Spinner
            v-if="
              api.queues[player.player_id]?.extra_attributes
                ?.play_action_in_progress === true
            "
            :class="getBreakpointValue({ breakpoint: 'phone' }) ? 'h-6 w-6' : 'h-[26px] w-[26px]'"
          />
          <component
            :is="player.playback_state == PlaybackState.PLAYING ? Pause : Play"
            v-else
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? 30 : 32"
          />
        </Button>

        <!-- menu button -->
        <Button
          v-if="showMenuButton"
          variant="ghost-icon"
          size="icon"
          class="player-command-btn"
          style="margin-right: -5px"
          @click.stop="openPlayerMenu"
        >
          <MoreVertical
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? 26 : 30"
          />
        </Button>
      </div>
    </div>
    <VolumeControl
      v-if="showVolumeControl"
      :player="player"
      :show-sync-controls="showSyncControls"
      :show-heading-row="false"
      :show-sub-players="showSubPlayers"
      :show-volume-control="player.powered != false"
      :allow-wheel="false"
      @toggle-expand="$emit('toggle-expand', player)"
    />
  </div>
</template>

<script setup lang="ts">
import {
  imgCoverDark,
  imgCoverLight,
} from "@/components/QualityDetailsBtn.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import VolumeControl from "@/components/VolumeControl.vue";
import { useActiveSource } from "@/composables/activeSource";
import { getPlayerMenuItems } from "@/helpers/player_menu_items";
import {
  getColorPalette,
  getMediaImageUrl,
  getPlayerName,
  ImageColorPalette,
  isBuiltinPlayer,
} from "@/helpers/utils";
import api from "@/plugins/api";
import {
  PlaybackState,
  Player,
  PLAYER_CONTROL_NONE,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { useIsDark } from "@/composables/useIsDark";
import { webPlayer } from "@/plugins/web_player";
import { resolveMdiIcon } from "@/helpers/iconMapping";
import { AudioLines, Monitor, MoreVertical, Pause, Play, Power, Smartphone, Speaker } from "lucide-vue-next";
import { computed, ref, toRef, watch } from "vue";

// properties
export interface Props {
  player: Player;
  showVolumeControl?: boolean;
  showMenuButton?: boolean;
  showSubPlayers?: boolean;
  showSyncControls?: boolean;
  allowPowerControl?: boolean;
}

const compProps = defineProps<Props>();
const { activeSource } = useActiveSource(toRef(compProps, "player"));

// emits
defineEmits<{
  (e: "click", player: Player): void;
  (e: "toggle-expand", player: Player): void;
}>();

const resolvedPlayerIcon = computed(() => {
  const p = compProps.player;
  if (p.type === PlayerType.PLAYER && p.group_members.length) {
    return AudioLines;
  }
  return (p.icon ? resolveMdiIcon(p.icon) : undefined) || Speaker;
});

const playerQueue = computed(() => {
  if (
    compProps.player &&
    compProps.player.active_source &&
    compProps.player.active_source in api.queues
  ) {
    return api.queues[compProps.player.active_source];
  }
  if (
    compProps.player &&
    !compProps.player.active_source &&
    compProps.player.player_id in api.queues
  ) {
    return api.queues[compProps.player.player_id];
  }
  return undefined;
});

const openPlayerMenu = function (evt: Event) {
  eventbus.emit("contextmenu", {
    items: getPlayerMenuItems(compProps.player, playerQueue.value),
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

const canPlayPause = computed(() => {
  if (activeSource.value) {
    return activeSource.value.can_play_pause;
  }
  return false;
});

// local refs
const coverImageColorPalette = ref<ImageColorPalette>({
  "0": "",
  "1": "",
  "2": "",
  "3": "",
  "4": "",
  "5": "",
  lightColor: "",
  darkColor: "",
});

// utility feature to extract the dominant colors from the cover image
// we use this color palette to colorize the playerbar/OSD
const isDark = useIsDark();
const img = new Image();
img.src = isDark.value ? imgCoverDark : imgCoverLight;
img.crossOrigin = "Anonymous";
img.addEventListener("load", function () {
  coverImageColorPalette.value = getColorPalette(img);
});

watch(
  () => compProps.player.current_media?.image_url,
  (newImageUrl) => {
    img.src = getMediaImageUrl(newImageUrl) || "";
  },
  { immediate: true },
);
</script>

<style scoped>
.panel-item-details {
  width: 100%;
  margin: 0px;
  padding: 0px;
  min-height: 58px;
}

.player-media-thumb {
  margin-right: 0px;
}

.media-thumb {
  width: 44px;
  height: 44px;
  border-radius: 4px;
  background-color: var(--muted);
  object-fit: cover;
}
.icon-thumb {
  width: 44px;
  height: 44px;
  margin-top: 4px;
  border-radius: 4px;
  background-color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-item {
  border-style: ridge;
  border-width: thin;
  border-color: var(--border);
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 4px;
  padding-bottom: 4px;
  background-color: color-mix(in srgb, var(--primary) 4%, transparent);
  opacity: 1;
  transition: opacity 0.4s ease-in-out;
  border-radius: 6px;
  margin-left: 0px;
  margin-right: 0px;
  margin-top: 4px;
  margin-bottom: 4px;
  height: 100%;
  width: auto;
  cursor: pointer;
}
.panel-item-idle {
  opacity: 0.8;
}
.panel-item-off {
  opacity: 0.6;
}
.panel-item-selected {
  border-color: color-mix(in srgb, var(--primary) 60%, transparent);
  background-color: color-mix(in srgb, var(--primary) 30%, transparent);
}

.player-command-btn {
  width: 35px;
  min-width: 35px;
  margin-left: 5px;
}
</style>
