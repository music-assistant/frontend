<template>
  <div class="player-extended-controls">
    <!-- active player queue button -->
    <div v-if="props.buttonVisibility.queue">
      <v-btn
        v-if="props.activePlayerQueue"
        :width="props.smallBtnIcon.button"
        :height="props.smallBtnIcon.button"
        icon
        variant="plain"
        @click="
          props.showQueueDialog
            ? (showQueueDialog = true)
            : $router.push('/playerqueue/')
        "
      >
        <v-icon :size="props.smallBtnIcon.icon">
          {{ mdiPlaylistMusic }}
        </v-icon>
      </v-btn>
    </div>
    <!-- active player btn -->
    <div v-if="props.buttonVisibility.player">
      <v-btn
        :width="props.smallBtnIcon.button"
        :height="props.smallBtnIcon.button"
        icon
        variant="plain"
        @click="
          store.showPlayersMenu = true;
          store.showFullscreenPlayer = false;
        "
      >
        <v-icon :size="props.smallBtnIcon.icon">
          {{ mdiSpeaker }}
        </v-icon>
      </v-btn>
    </div>
    <!-- active player volume -->
    <div v-if="props.buttonVisibility.volume">
      <v-menu
        v-if="activePlayerQueue"
        v-model="showVolume"
        location="top end"
        :close-on-content-click="false"
      >
        <template #activator="{ props }">
          <div
            v-if="
              $vuetify.display.width >= getResponsiveBreakpoints.breakpoint_7 ||
              !responsiveVolumeSize
            "
          >
            <PlayerVolume
              :style="'margin-right: 0px;'"
              :width="volumeSize"
              :is-powered="true"
              :model-value="
                store.selectedPlayer?.is_group
                  ? Math.round(store.selectedPlayer?.group_volume_level)
                  : Math.round(store.selectedPlayer?.volume_level)
              "
              @update:model-value="
                store.selectedPlayer?.is_group
                  ? api.queueCommandGroupVolume(
                      store.selectedPlayer?.player_id,
                      $event
                    )
                  : api.queueCommandVolume(
                      store.selectedPlayer?.player_id,
                      $event
                    )
              "
            >
              <template #prepend>
                <!-- select player -->
                <v-btn
                  :width="smallBtnIcon.button"
                  :height="smallBtnIcon.button"
                  icon
                  variant="plain"
                  v-bind="props"
                >
                  <v-icon :size="smallBtnIcon.icon" :icon="mdiVolumeHigh" />
                  <div class="text-caption">
                    {{
                      store.selectedPlayer?.is_group
                        ? Math.round(
                            store.selectedPlayer?.group_volume_level || 0
                          )
                        : Math.round(store.selectedPlayer?.volume_level || 0)
                    }}
                  </div>
                </v-btn>
              </template>
            </PlayerVolume>
          </div>
          <div v-else>
            <v-btn
              :width="smallBtnIcon.button"
              :height="smallBtnIcon.button"
              icon
              variant="plain"
              v-bind="props"
            >
              <v-icon :size="smallBtnIcon.icon" :icon="mdiVolumeHigh" />
              <div class="text-caption">
                {{
                  store.selectedPlayer?.is_group
                    ? Math.round(store.selectedPlayer?.group_volume_level || 0)
                    : Math.round(store.selectedPlayer?.volume_level || 0)
                }}
              </div>
            </v-btn>
          </div>
        </template>

        <v-card min-width="350">
          <v-list style="overflow: hidden" lines="two">
            <v-list-item
              density="compact"
              two-line
              :title="store.selectedPlayer?.group_name.substring(0, 25)"
              :subtitle="$t('state.' + store.selectedPlayer?.state)"
              style="padding-right: 0px"
            >
              <template #prepend>
                <v-icon
                  size="50"
                  :icon="
                    store.selectedPlayer?.is_group
                      ? mdiSpeakerMultiple
                      : mdiSpeaker
                  "
                  color="accent"
                  style="
                    padding-left: 0px;
                    padding-right: 0px;
                    margin-left: -10px;
                    margin-right: 10px;
                    width: 42px;
                    height: 50px;
                  "
                />
              </template>
              <v-btn
                variant="plain"
                style="position: absolute; right: 0px; top: 0px"
                :icon="mdiClose"
                dark
                @click="showVolume = !showVolume"
              />
            </v-list-item>
            <v-divider />
            <VolumeControl
              v-if="store.selectedPlayer"
              :player="store.selectedPlayer"
            />
          </v-list>
        </v-card>
      </v-menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  mdiPlaylistMusic,
  mdiSpeaker,
  mdiClose,
  mdiSpeakerMultiple,
  mdiVolumeHigh,
} from '@mdi/js';
import { api, type PlayerQueue } from '@/plugins/api';
import { store } from '@/plugins/store';
import { ref } from 'vue';
import VolumeControl from '../VolumeControl.vue';
import { getResponsiveBreakpoints } from '@/utils';
import PlayerVolume from './PlayerVolume.vue';
import { showQueueDialog } from '../PlayerQueue.vue';

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  activePlayerQueue?: PlayerQueue;
  volumeSize?: string;
  responsiveVolumeSize?: boolean;
  showQueueDialog?: boolean;
  buttonVisibility?: {
    queue: boolean;
    player: boolean;
    volume: boolean;
  };
  smallBtnIcon: {
    button: number;
    icon: number;
  };
}

const props = withDefaults(defineProps<Props>(), {
  smallBtnIcon: () => ({ button: 40, icon: 24 }),
  volumeSize: '150px',
  responsiveVolumeSize: true,
  showQueueDialog: false,
  buttonVisibility: () => ({
    queue: true,
    player: true,
    volume: true,
  }),
});

const showVolume = ref(false);
</script>

<style scoped>
.player-extended-controls {
  display: contents;
  width: 100%;
}

.player-extended-controls > div {
  padding-right: 5px;
}
</style>
