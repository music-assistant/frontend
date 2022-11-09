<template>
  <v-list style="overflow: hidden" lines="2">
    <!-- special group volume -->
    <div v-if="player.is_group">
      <v-list-item density="compact" two-line style="padding-left: 0px">
        <template #title>
          <div
            class="line-clamp-1"
            style="padding-left: 10px; padding-right: 10px"
          >
            {{ player.group_name }}
          </div>
        </template>
        <template #subtitle>
          <PlayerVolume
            :disabled="!player.group_powered"
            :model-value="Math.round(player.group_volume_level)"
            class="list-item-subtitle-slider"
            @update:model-value="
              api.queueCommandGroupVolume(player.player_id, $event)
            "
          />
        </template>
        <template #prepend>
          <div :style="player.group_powered ? 'opacity: 0.75' : 'opacity: 0.5'">
            <div>
              <v-btn
                icon
                variant="plain"
                width="50"
                height="30"
                size="x-large"
                @click="
                  api.queueCommandGroupPower(
                    player.player_id,
                    !player.group_powered
                  )
                "
              >
                <v-icon :icon="mdiPower" />
              </v-btn>
            </div>
            <div class="text-caption" style="text-align: center">
              {{ player.group_volume_level }}
            </div>
          </div>
          <div
            :style="player.group_powered ? 'opacity: 0.75' : 'opacity: 0.5;'"
          >
            <div>
              <v-btn icon variant="plain" width="50" height="30" size="x-large">
                <v-icon
                  :icon="
                    player.group_volume_level == 0
                      ? mdiVolumeMute
                      : mdiVolumeHigh
                  "
                />
              </v-btn>
            </div>
            <div class="text-caption" style="text-align: center">
              {{ player.group_volume_level == 0 ? $t('muted') : $t('unmuted') }}
            </div>
          </div>
        </template>
      </v-list-item>
    </div>
    <v-divider v-if="player.is_group" />
    <div
      v-for="childPlayer in getVolumePlayers(player)"
      :key="childPlayer.player_id"
    >
      <v-list-item density="compact" two-line style="padding-left: 0px">
        <template #title>
          <div
            class="line-clamp-1"
            style="padding-left: 10px; padding-right: 10px"
          >
            {{
              player.group_members.includes(childPlayer.player_id)
                ? childPlayer.name
                : childPlayer.group_name
            }}
          </div>
        </template>
        <template #subtitle>
          <PlayerVolume
            :disabled="!childPlayer.powered"
            :model-value="Math.round(childPlayer.volume_level)"
            class="list-item-subtitle-slider"
            @update:model-value="
              api.queueCommandVolume(childPlayer.player_id, $event)
            "
          />
        </template>
        <template #prepend>
          <div :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5'">
            <div>
              <v-btn
                icon
                variant="plain"
                width="50"
                height="30"
                size="x-large"
                @click="
                  api.queueCommandGroupPower(
                    player.player_id,
                    !player.group_powered
                  )
                "
              >
                <v-icon :icon="mdiPower" />
              </v-btn>
            </div>
            <div class="text-caption" style="text-align: center">
              {{ Math.round(childPlayer.volume_level) }}
            </div>
          </div>
          <div :style="childPlayer.powered ? 'opacity: 0.75' : 'opacity: 0.5;'">
            <div>
              <v-btn icon variant="plain" width="50" height="30" size="x-large">
                <v-icon
                  :icon="
                    player.group_volume_level == 0
                      ? mdiVolumeMute
                      : mdiVolumeHigh
                  "
                />
              </v-btn>
            </div>
            <div class="text-caption" style="text-align: center">
              {{ player.group_volume_level == 0 ? $t('muted') : $t('unmuted') }}
            </div>
          </div>
        </template>
      </v-list-item>
    </div>
  </v-list>
</template>

<script setup lang="ts">
import type { Player } from '../plugins/api';
import { mdiPower, mdiVolumeHigh, mdiVolumeMute } from '@mdi/js';
import { api } from '../plugins/api';
import { truncateString } from '../utils';
import { store } from '@/plugins/store';
import PlayerVolume from './PlayerOSD/PlayerVolume.vue';

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  player: Player;
  smallBtnIcon: {
    button: number;
    icon: number;
  };
}

const props = withDefaults(defineProps<Props>(), {
  smallBtnIcon: () => ({ button: 40, icon: 24 }),
});

const getVolumePlayers = function (player: Player) {
  const items: Player[] = [];
  if (!player.is_group) {
    return [player];
  }
  for (const groupChildId of player.group_members) {
    const volumeChild = api?.players[groupChildId];

    if (volumeChild && volumeChild.available) {
      items.push(volumeChild);
    }
  }
  items.sort((a, b) => (a.name.toUpperCase() > b.name.toUpperCase() ? 1 : -1));
  return items;
};
</script>
