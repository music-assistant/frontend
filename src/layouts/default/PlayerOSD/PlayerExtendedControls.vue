<template>
  <!-- active player queue button -->
  <v-btn
    v-if="activePlayerQueue && componentProps.buttonVisibility.queue"
    icon
    variant="plain"
    @click="store.showFullscreenPlayer = false;$router.push('/playerqueue/')"
  >
    <v-icon icon="mdi-playlist-music" />
  </v-btn>
  <!-- active player btn -->
  <v-btn
    v-if="componentProps.buttonVisibility.player"
    icon
    variant="plain"
    class="mediacontrols-right"
    @click="store.showPlayersMenu = true"
  >
    <v-icon icon="mdi-speaker" />
  </v-btn>
  <!-- active player volume -->
  <div v-if="componentProps.buttonVisibility.volume">
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
                ? api.playerCommandGroupVolume(
                    store.selectedPlayer?.player_id || '',
                    $event
                  )
                : api.playerCommandVolumeSet(
                    store.selectedPlayer?.player_id || '',
                    $event
                  )
            "
          >
            <template #prepend>
              <!-- select player -->
              <v-btn icon variant="plain" v-bind="props">
                <v-icon icon="mdi-volume-high" />
                <div class="text-caption">
                  {{
                    store.selectedPlayer!.group_childs.length > 0
                      ? Math.round(store.selectedPlayer?.group_volume || 0)
                      : Math.round(store.selectedPlayer?.volume_level || 0)
                  }}
                </div>
              </v-btn>
            </template>
          </PlayerVolume>
        </div>
        <div v-else>
          <v-btn icon variant="plain" v-bind="props">
            <v-icon icon="mdi-volume-high" />
            <div class="text-caption">
              {{
                store.selectedPlayer!.group_childs.length > 0
                  ? Math.round(store.selectedPlayer?.group_volume || 0)
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
            :title="store.selectedPlayer?.name.substring(0, 25)"
            :subtitle="$t('state.' + store.selectedPlayer?.state)"
            style="padding-right: 0px"
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
              icon="mdi-close"
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
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import api from "@/plugins/api";
import { store } from "@/plugins/store";
import { getResponsiveBreakpoints } from "@/utils";
import PlayerVolume from "./PlayerVolume.vue";
import VolumeControl from "@/components/VolumeControl.vue";

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  volumeSize?: string;
  responsiveVolumeSize?: boolean;
  buttonVisibility?: {
    queue?: boolean;
    player?: boolean;
    volume?: boolean;
  };
}

const componentProps = withDefaults(defineProps<Props>(), {
  volumeSize: "150px",
  responsiveVolumeSize: true,
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
