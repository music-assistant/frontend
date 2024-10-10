<template>
  <v-card
    flat
    class="panel-item"
    :class="{
      'panel-item-selected': player.player_id == store.activePlayerId,
      'panel-item-idle': player.state == PlayerState.IDLE,
      'panel-item-off': !player.powered,
    }"
    :ripple="false"
  >
    <!-- now playing media -->
    <v-list-item class="panel-item-details" flat :ripple="false">
      <!-- prepend: media thumb -->
      <template #prepend>
        <div v-if="player.powered" class="player-media-thumb">
          <MediaItemThumb
            v-if="curQueueItem?.media_item || curQueueItem?.image"
            class="media-thumb"
            size="55"
            :item="curQueueItem?.media_item || curQueueItem"
            :fallback="imgCoverDark"
          />
          <div v-else-if="player.current_media?.image_url">
            <v-img
              class="media-thumb"
              size="55"
              :src="player.current_media.image_url"
            />
          </div>
          <div v-else class="icon-thumb">
            <v-icon
              size="35"
              :icon="
                player.type == PlayerType.PLAYER && player.group_childs.length
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
        <div style="margin-bottom: 3px">{{ getPlayerName(player, 27) }}</div>
      </template>

      <!-- subtitle: media item title -->
      <template #subtitle>
        <div
          v-if="player.powered"
          style="font-size: 0.85rem; font-weight: 500; white-space: nowrap"
        >
          <div v-if="curQueueItem?.media_item">
            {{ curQueueItem?.media_item.name }}
            <span
              v-if="
                'version' in curQueueItem?.media_item &&
                curQueueItem?.media_item.version
              "
              >({{ curQueueItem?.media_item.version }})</span
            >
          </div>
          <div v-else-if="curQueueItem">
            {{ curQueueItem?.name }}
          </div>
          <div v-else-if="player.current_media?.title">
            {{ player.current_media.title }}
          </div>
        </div>
      </template>

      <!-- subtitle -->
      <template #default>
        <div class="v-list-item-subtitle" style="white-space: nowrap">
          <!-- player powered off -->
          <div v-if="!player.powered">
            {{ $t('off') }}
          </div>
          <!-- track: artists(s) + album -->
          <div
            v-else-if="
              curQueueItem?.media_item &&
              curQueueItem?.media_item?.media_type == MediaType.TRACK &&
              'album' in curQueueItem?.media_item &&
              curQueueItem?.media_item.album
            "
          >
            {{ getArtistsString(curQueueItem?.media_item.artists) }} •
            {{ curQueueItem?.media_item.album.name }}
          </div>
          <!-- track/album fallback: artist present -->
          <div
            v-else-if="
              curQueueItem?.media_item &&
              'artists' in curQueueItem?.media_item &&
              curQueueItem?.media_item.artists.length > 0
            "
          >
            {{ curQueueItem?.media_item.artists[0].name }}
          </div>
          <!-- radio live metadata -->
          <div v-else-if="curQueueItem?.streamdetails?.stream_title">
            {{ curQueueItem?.streamdetails?.stream_title }}
          </div>
          <!-- other description -->
          <div v-else-if="curQueueItem?.media_item?.metadata.description">
            {{ curQueueItem?.media_item.metadata.description }}
          </div>
          <!-- queue empty message -->
          <div v-else-if="playerQueue?.items == 0">
            {{ $t('queue_empty') }}
          </div>
          <!-- 3rd party source active -->
          <div v-else-if="player.active_source != player.player_id">
            {{ $t('external_source_active', [player.active_source]) }}
          </div>
        </div>
      </template>

      <!-- power/play/pause + menu button -->
      <template #append>
        <!-- power button -->
        <Button
          v-if="!player.powered"
          variant="icon"
          class="player-command-btn"
          @click.stop="api.playerCommandPowerToggle(player.player_id)"
          ><v-icon
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '30' : '32'"
            >mdi-power</v-icon
          ></Button
        >
        <!-- pause button (only when playing) -->
        <Button
          v-else-if="player.state == PlayerState.PLAYING"
          class="player-command-btn"
          @click.stop="api.playerCommandPlayPause(player.player_id)"
          ><v-icon
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '30' : '32'"
            >mdi-pause-circle-outline</v-icon
          ></Button
        >
        <!-- play button (disabled if we can't play)-->
        <Button
          v-else
          variant="icon"
          class="player-command-btn"
          :disabled="!playerQueue?.items && !player.current_media"
          @click.stop="api.playerCommandPlay(player.player_id)"
          ><v-icon
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '30' : '32'"
            >mdi-play-circle-outline</v-icon
          ></Button
        >
        <Button
          v-if="showMenuButton"
          variant="icon"
          class="player-command-btn"
          style="margin-right: -5px"
          @click.stop="openPlayerMenu"
        >
          <v-icon
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '30' : '32'"
            >mdi-dots-vertical</v-icon
          >
        </Button>
      </template>
    </v-list-item>
    <VolumeControl
      v-if="showVolumeControl && player.powered"
      :player="player"
      :show-sync-controls="showSyncControls"
      :hide-heading-row="true"
      :show-sub-players="showSubPlayers"
    />
  </v-card>
</template>

<script setup lang="ts">
import api from '@/plugins/api';
import {
  MediaType,
  Player,
  PlayerFeature,
  PlayerState,
  PlayerType,
} from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import MediaItemThumb from '@/components/MediaItemThumb.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import { imgCoverDark } from '@/components/QualityDetailsBtn.vue';
import { getArtistsString } from '@/helpers/utils';
import { computed, ref } from 'vue';
import { getPlayerName } from '@/helpers/utils';
import Button from '@/components/mods/Button.vue';
import VolumeControl from '@/components/VolumeControl.vue';
import { eventbus } from '@/plugins/eventbus';
import router from '@/plugins/router';
import { ContextMenuItem } from '@/layouts/default/ItemContextMenu.vue';
// properties
export interface Props {
  player: Player;
  showVolumeControl?: boolean;
  showMenuButton?: boolean;
  showSubPlayers?: boolean;
  showSyncControls?: boolean;
}
const compProps = defineProps<Props>();

const playerQueue = computed(() => {
  if (compProps.player && compProps.player.active_source in api.queues) {
    return api.queues[compProps.player.active_source];
  }
  if (compProps.player && compProps.player.player_id in api.queues) {
    return api.queues[compProps.player.player_id];
  }
  return undefined;
});
const curQueueItem = computed(() => {
  if (playerQueue.value && playerQueue.value.active)
    return playerQueue.value.current_item;
  return undefined;
});

const openPlayerMenu = function (evt: Event) {
  const menuItems: ContextMenuItem[] = [
    {
      label: compProps.player.powered ? 'power_off_player' : 'power_on_player',
      labelArgs: [],
      action: () => {
        api.playerCommandPowerToggle(compProps.player.player_id);
      },
      icon: 'mdi-power',
    },
  ];

  // add 'transfer queue' menu item
  if (playerQueue?.value?.items) {
    menuItems.push({
      label: 'transfer_queue',
      icon: 'mdi-swap-horizontal',
      subItems: Object.values(api.queues)
        .filter((p) => p.queue_id != playerQueue.value!.queue_id && p.available)
        .map((p) => {
          return {
            label: p.display_name,
            labelArgs: [],
            action: () => {
              api.queueCommandTransfer(playerQueue.value!.queue_id, p.queue_id);
              store.activePlayerId = p.queue_id;
            },
          };
        })
        .sort((a, b) =>
          a.label.toUpperCase() > b.label?.toUpperCase() ? 1 : -1,
        ),
    });
  }
  // add 'clear queue' menu item
  if (playerQueue?.value?.items) {
    menuItems.push({
      label: 'queue_clear',
      labelArgs: [],
      action: () => {
        api.queueCommandClear(playerQueue.value!.queue_id);
      },
      icon: 'mdi-cancel',
    });
  }
  // add player settings
  menuItems.push({
    label: 'settings.player_settings',
    labelArgs: [],
    action: () => {
      store.showFullscreenPlayer = false;
      store.showPlayersMenu = false;
      router.push(`/settings/editplayer/${compProps.player.player_id}`);
    },
    icon: 'mdi-cog-outline',
  });

  eventbus.emit('contextmenu', {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};
</script>

<style scoped>
.v-card {
  transition: opacity 0.4s ease-in-out;
  border-radius: 6px;
  margin: 5px;
  margin-bottom: 10px;
}
.panel-item {
  height: 100%;
  border-style: ridge;
  border-width: thin;
  border-color: #cccccc5e;
  padding: 10px;
  background-color: rgba(162, 188, 255, 0.1);
  opacity: 1;
}

.panel-item-idle {
  opacity: 0.8;
}

.panel-item-off {
  opacity: 0.6;
}

.panel-item-selected {
  border-color: #2f2f2f5e;
  background-color: rgba(162, 188, 255, 0.4);
}

.panel-item-details {
  align-items: center;
  margin-left: 0px !important;
  padding-left: 0px !important;
  padding-right: 0px !important;
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

.media-thumb {
  width: 55px;
  height: 55px;
  margin-top: 5px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.3);
  display: inline-table;
}

.icon-thumb {
  width: 55px;
  height: 55px;
  margin-top: 5px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.3);
  display: inline-table;
}

.player-command-btn {
  width: 35px;
  min-width: 35px;
  margin-left: 5px;
}
</style>
