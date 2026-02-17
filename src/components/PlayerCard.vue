<template>
  <v-card
    flat
    class="panel-item"
    :class="{
      'panel-item-selected': player.player_id == store.activePlayerId,
      'panel-item-idle': player.playback_state == PlaybackState.IDLE,
      'panel-item-off': player.powered == false,
    }"
    :ripple="false"
    :disabled="!player.available"
    @click="$emit('click', player)"
  >
    <!-- now playing media -->
    <v-list-item class="panel-item-details" flat :ripple="false">
      <!-- prepend: media thumb -->
      <template #prepend>
        <div class="player-media-thumb">
          <!-- current media image -->
          <div
            v-if="player.powered != false && player.current_media?.image_url"
          >
            <v-img
              class="media-thumb"
              size="60"
              :src="getMediaImageUrl(player.current_media.image_url)"
            />
          </div>
          <!-- fallback: display player icon -->
          <div v-else class="icon-thumb">
            <v-icon
              size="24"
              :icon="
                player.type == PlayerType.PLAYER && player.group_members.length
                  ? 'mdi-speaker-multiple'
                  : player.icon
              "
              style="display: table-cell; opacity: 0.8"
            />
          </div>
        </div>
      </template>

      <!-- playername -->
      <template #title>
        <!-- special builtin player (web player or companion native player) -->
        <div
          v-if="
            player.output_protocols?.filter(
              (x) =>
                x.output_protocol_id == webPlayer.player_id ||
                x.output_protocol_id == store.companionPlayerId,
            ).length !== 0
          "
          style="margin-bottom: 3px"
        >
          <span>{{
            getPlayerName(player, store.deviceType == "phone" ? 10 : 16)
          }}</span>
          <!-- append small icon to the title -->
          <v-chip density="compact" size="small" class="ml-2" outlined>
            <v-icon
              size="14"
              :icon="
                store.deviceType == 'phone' ? 'mdi-cellphone' : 'mdi-monitor'
              "
              style="margin-right: 6px"
            />
            {{ $t("this_device") }}
          </v-chip>
        </div>
        <!-- regular player -->
        <div v-else>
          {{ getPlayerName(player, 27) }}
        </div>
      </template>

      <!-- subtitle: media item title -->
      <template #subtitle>
        <div
          v-if="player.powered != false"
          style="font-size: 0.85rem; font-weight: 500; white-space: nowrap"
        >
          <div v-if="player.current_media?.title">
            {{ player.current_media.title }}
          </div>
        </div>
      </template>

      <!-- subtitle -->
      <template #default>
        <div
          class="v-list-item-subtitle"
          style="font-size: 0.85rem; white-space: nowrap"
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
          >
            {{ player.current_media.artist }} •
            {{ player.current_media.album }}
          </div>
          <!-- artist only -->
          <div v-else-if="player.current_media?.artist">
            {{ player.current_media.artist }}
          </div>
          <!-- album only -->
          <div v-else-if="player.current_media?.album">
            {{ player.current_media.album }}
          </div>
          <!-- queue empty message -->
          <div v-else-if="playerQueue?.items == 0">
            {{ $t("queue_empty") }}
          </div>
        </div>
      </template>

      <!-- power/play/pause + menu button -->
      <template #append>
        <!-- play/pause button -->
        <Button
          v-if="
            player.playback_state == PlaybackState.PAUSED ||
            player.playback_state == PlaybackState.PLAYING ||
            playerQueue?.items
          "
          variant="ghost-icon"
          size="icon"
          class="player-command-btn"
          @click.stop="
            api.playerCommandPlayPause(player.player_id);
            store.activePlayerId = player.player_id;
          "
        >
          <component
            :is="player.playback_state == PlaybackState.PLAYING ? Pause : Play"
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
          <v-badge
            color="primary"
            :offset-x="-5"
            :offset-y="-5"
            :content="
              player.type == PlayerType.GROUP
                ? player.group_members.length
                : player.group_members.length || 1
            "
            class="group-badge"
          >
            <Speaker
              :size="getBreakpointValue({ breakpoint: 'phone' }) ? 24 : 26"
            />
          </v-badge>
        </Button>

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
      </template>
    </v-list-item>
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
  </v-card>
</template>

<script setup lang="ts">
import {
  imgCoverDark,
  imgCoverLight,
} from "@/components/QualityDetailsBtn.vue";
import { Button } from "@/components/ui/button";
import VolumeControl from "@/components/VolumeControl.vue";
import { getPlayerMenuItems } from "@/helpers/player_menu_items";
import {
  getColorPalette,
  getMediaImageUrl,
  getPlayerName,
  ImageColorPalette,
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
import vuetify from "@/plugins/vuetify";
import { webPlayer } from "@/plugins/web_player";
import { MoreVertical, Pause, Play, Power, Speaker } from "lucide-vue-next";
import { computed, ref, watch } from "vue";

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

// emits
defineEmits<{
  (e: "click", player: Player): void;
  (e: "toggle-expand", player: Player): void;
}>();

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
const img = new Image();
img.src = vuetify.theme.current.value.dark ? imgCoverDark : imgCoverLight;
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
  margin: 0px !important;
  padding: 0px !important;
  min-height: 72px;
}

.panel-item-details :deep(.v-list-item__content) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 60px;
}

.volumesliderrow {
  margin-top: 0px;
  padding-top: 0px;
  padding-bottom: 0px;
  height: 24px;
  min-height: 24px;
}

.volumecaption {
  width: 25px;
  text-align: right;
  margin-right: 0px;
}

.volumesliderrow :deep(.v-list-item__prepend) {
  width: 40px;
  margin-left: -25px;
}
.volumesliderrow :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}

.player-media-thumb {
  margin-right: 10px;
}

.media-thumb {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}

.icon-thumb {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-thumb {
  width: 55px;
  height: 55px;
  border-radius: 4px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
}
.icon-thumb {
  width: 55px;
  height: 55px;
  margin-top: 5px;
  border-radius: 4px;
  background-color: rgba(var(--v-theme-on-surface), 0.08);
  display: inline-table;
}

.panel-item {
  border-style: ridge;
  border-width: thin;
  border-color: rgba(var(--v-theme-on-surface), 0.12);
  padding-left: 8px;
  padding-right: 8px;
  padding-top: 5px;
  padding-bottom: 5px;
  background-color: rgba(var(--v-theme-primary), 0.04);
  opacity: 1;
  transition: opacity 0.4s ease-in-out;
  border-radius: 6px;
  margin-left: 0px;
  margin-right: 0px;
  margin-top: 5px;
  margin-bottom: 8px;
  height: 100%;
  width: auto;
}
.panel-item-idle {
  opacity: 0.8;
}
.panel-item-off {
  opacity: 0.6;
}
.panel-item-selected {
  border-color: rgba(var(--v-theme-primary), 0.6);
  background-color: rgba(var(--v-theme-primary), 0.3);
}

.player-command-btn {
  width: 35px;
  min-width: 35px;
  margin-left: 5px;
}

.group-badge :deep(.v-badge__badge) {
  font-size: 10px;
  height: 14px;
  min-width: 14px;
  padding: 0 4px 0 4px;
}
</style>
