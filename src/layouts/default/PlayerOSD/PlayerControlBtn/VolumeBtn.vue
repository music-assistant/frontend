<template>
  <!-- active player volume -->
  <div v-if="props.isVisible && store.activePlayer">
    <v-menu
      v-model="showVolume"
      class="volume-control-dialog"
      :close-on-content-click="false"
      location="top"
      :scrim="
        $vuetify.theme.current.dark ? 'rgba(0,0,0,.75)' : 'rgba(0,0,0,.85)'
      "
    >
      <template #activator="{ props: menu }">
        <div v-if="getBreakpointValue('bp6') || !responsiveVolumeSize">
          <PlayerVolume
            :style="'margin-right: 0px; margin-left: 0px;'"
            :width="volumeSize"
            :is-powered="store.activePlayer?.powered != false"
            :disabled="
              !store.activePlayer?.available ||
              store.activePlayer?.powered == false ||
              !store.activePlayer?.supported_features.includes(
                PlayerFeature.VOLUME_SET,
              )
            "
            :model-value="
              store.activePlayer!.group_members.length > 0
                ? Math.round(store.activePlayer?.group_volume || 0)
                : Math.round(store.activePlayer?.volume_level || 0)
            "
            :allow-wheel="true"
            @update:model-value="
              store.activePlayer!.group_members.length > 0
                ? api.playerCommandGroupVolume(
                    store.activePlayer?.player_id || '',
                    $event,
                  )
                : api.playerCommandVolumeSet(
                    store.activePlayer?.player_id || '',
                    $event,
                  )
            "
          >
            <template #prepend>
              <!-- select player -->
              <Button
                variant="icon"
                size="48"
                :ripple="false"
                v-bind="{ ...menu }"
              >
                <v-icon
                  :color="props.color ? color : ''"
                  :size="24"
                  :icon="volumeIcon"
                />
                <div class="text-caption">
                  {{
                    store.activePlayer!.group_members.length > 0
                      ? Math.round(store.activePlayer?.group_volume || 0)
                      : Math.round(store.activePlayer?.volume_level || 0)
                  }}
                </div>
              </Button>
            </template>
          </PlayerVolume>
        </div>
        <div v-else>
          <Button v-bind="{ ...menu }" size="48" variant="icon">
            <v-icon :color="props.color ? color : ''" :icon="volumeIcon" />
            <div
              class="text-caption"
              :style="{ color: props.color ? color : '' }"
            >
              {{
                store.activePlayer!.group_members.length > 0
                  ? Math.round(store.activePlayer?.group_volume || 0)
                  : Math.round(store.activePlayer?.volume_level || 0)
              }}
            </div>
          </Button>
        </div>
      </template>

      <v-card
        :min-width="300"
        style="
          overflow: hidden;
          padding-top: 20px;
          padding-bottom: 20px;
          padding-right: 20px;
        "
      >
        <VolumeControl
          v-if="store.activePlayer"
          :player="store.activePlayer"
          :show-sub-players="true"
          :show-sync-controls="false"
          :show-heading-row="true"
          :show-volume-control="true"
          :allow-wheel="true"
          style="margin-left: 18px"
        />
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import VolumeControl from "@/components/VolumeControl.vue";
import api from "@/plugins/api";
import { PlayerFeature } from "@/plugins/api/interfaces";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { computed, ref } from "vue";
import PlayerVolume from "../PlayerVolume.vue";

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  volumeSize?: string;
  responsiveVolumeSize?: boolean;
  isVisible?: boolean;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  volumeSize: "150px",
  responsiveVolumeSize: true,
  isVisible: true,
  color: "",
});

//refs
const showVolume = ref(false);

// computed
const volumeIcon = computed(() => {
  if (!store.activePlayer) return "mdi-volume-high";
  if (store.activePlayer.volume_muted) {
    return "mdi-volume-mute";
  }
  const volume =
    store.activePlayer.group_members.length > 0
      ? store.activePlayer.group_volume
      : store.activePlayer.volume_level || 0;
  if (volume === 0) {
    return "mdi-volume-low";
  } else if (volume < 50) {
    return "mdi-volume-medium";
  } else {
    return "mdi-volume-high";
  }
});
</script>

<style scoped>
.volume-control-dialog > .v-overlay__content {
  bottom: 135px !important;
  right: 5px !important;
  left: unset !important;
  top: unset !important;
}

.v-overlay__scrim {
  opacity: 0.4;
}
</style>
