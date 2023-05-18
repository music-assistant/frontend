<template>
  <!-- active player queue button -->
  <ButtonIcon
    v-if="props.buttonVisibility.queue"
    @click="
      store.showFullscreenPlayer = false;
      props.showQueueDialog
        ? // eslint-disable-next-line vue/no-mutating-props
          (props.showQueueDialog = true)
        : router.push('/playerqueue/');
    "
  >
    <v-icon icon="mdi-playlist-play" />
  </ButtonIcon>
  <!-- active player btn -->
  <ButtonIcon v-if="props.buttonVisibility.player" class="mediacontrols-right" @click="store.showPlayersMenu = true">
    <v-icon icon="mdi-speaker" />
  </ButtonIcon>
  <!-- active player volume -->
  <div v-if="props.buttonVisibility.volume">
    <v-menu v-if="activePlayerQueue" class="volume-control-dialog" v-model="showVolume" :close-on-content-click="false">
      <template #activator="{ props }">
        <div v-if="getBreakpointValue('bp5') || !responsiveVolumeSize">
          <PlayerVolume
            :style="'margin-right: 0px; margin-left: 0px;'"
            :width="volumeSize"
            :is-powered="true"
            :model-value="
              store.selectedPlayer!.group_childs.length > 0
                ? Math.round(store.selectedPlayer?.group_volume || 0)
                : Math.round(store.selectedPlayer?.volume_level || 0)
            "
            @update:model-value="
              store.selectedPlayer!.group_childs.length > 0
                ? api.playerCommandGroupVolume(store.selectedPlayer?.player_id || '', $event)
                : api.playerCommandVolumeSet(store.selectedPlayer?.player_id || '', $event)
            "
          >
            <template #prepend>
              <!-- select player -->
              <ButtonIcon v-bind="props">
                <v-icon icon="mdi-volume-high" />
                <div class="text-caption">
                  {{
                    store.selectedPlayer!.group_childs.length > 0
                      ? Math.round(store.selectedPlayer?.group_volume || 0)
                      : Math.round(store.selectedPlayer?.volume_level || 0)
                  }}
                </div>
              </ButtonIcon>
            </template>
          </PlayerVolume>
        </div>
        <div v-else>
          <ButtonIcon v-bind="props">
            <v-icon icon="mdi-volume-high" />
            <div class="text-caption">
              {{
                store.selectedPlayer!.group_childs.length > 0
                  ? Math.round(store.selectedPlayer?.group_volume || 0)
                  : Math.round(store.selectedPlayer?.volume_level || 0)
              }}
            </div>
          </ButtonIcon>
        </div>
      </template>

      <v-card :min-width="300">
        <v-list style="overflow: hidden" lines="two">
          <ListItem
            density="compact"
            two-line
            :title="store.selectedPlayer?.name.substring(0, 25)"
            :subtitle="$t('state.' + store.selectedPlayer?.state)"
          >
            <template #prepend>
              <v-icon
                size="50"
                :icon="
                store.selectedPlayer!.group_childs.length > 0
                  ? 'mdi-speaker-multiple'
                  : 'mdi-speaker'
              "
                color="accent"
              />
            </template>
            <v-btn
              variant="plain"
              style="position: absolute; right: 0px; top: 0px"
              icon="mdi-close"
              dark
              @click="showVolume = !showVolume"
            />
          </ListItem>
          <v-divider />
          <VolumeControl v-if="store.selectedPlayer" :player="store.selectedPlayer" />
        </v-list>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import api from '@/plugins/api';
import { store } from '@/plugins/store';
import PlayerVolume from './PlayerVolume.vue';
import VolumeControl from '@/components/VolumeControl.vue';
import ButtonIcon from '@/components/ButtonIcon.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/ListItem.vue';

const router = useRouter();

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  volumeSize?: string;
  responsiveVolumeSize?: boolean;
  showQueueDialog?: boolean;
  buttonVisibility?: {
    queue?: boolean;
    player?: boolean;
    volume?: boolean;
  };
}

const props = withDefaults(defineProps<Props>(), {
  volumeSize: '150px',
  responsiveVolumeSize: true,
  showQueueDialog: false,
  buttonVisibility: () => ({
    queue: true,
    player: true,
    volume: true,
  }),
});

//refs
const showVolume = ref(false);

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
</script>

<style>
.volume-control-dialog > .v-overlay__content {
  bottom: 90px !important;
  right: 10px !important;
  left: unset !important;
  top: unset !important;
}
</style>
