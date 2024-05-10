<template>
  <!-- active player volume -->
  <div v-if="props.isVisible && store.activePlayer">
    <v-menu
      v-model="showVolume"
      class="volume-control-dialog"
      :close-on-content-click="false"
      :scrim="
        $vuetify.theme.current.dark ? 'rgba(0,0,0,.75)' : 'rgba(0,0,0,.85)'
      "
    >
      <template #activator="{ props: menu }">
        <div v-if="getBreakpointValue('bp5') || !responsiveVolumeSize">
          <PlayerVolume
            :style="'margin-right: 0px; margin-left: 0px;'"
            :width="volumeSize"
            :is-powered="true"
            :model-value="
              store.activePlayer!.group_childs.length > 0
                ? Math.round(store.activePlayer?.group_volume || 0)
                : Math.round(store.activePlayer?.volume_level || 0)
            "
            @update:model-value="
              store.activePlayer!.group_childs.length > 0
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
                  icon="mdi-volume-high"
                />
                <div class="text-caption">
                  {{
                    store.activePlayer!.group_childs.length > 0
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
            <v-icon :color="props.color ? color : ''" icon="mdi-volume-high" />
            <div
              class="text-caption"
              :style="{ color: props.color ? color : '' }"
            >
              {{
                store.activePlayer!.group_childs.length > 0
                  ? Math.round(store.activePlayer?.group_volume || 0)
                  : Math.round(store.activePlayer?.volume_level || 0)
              }}
            </div>
          </Button>
        </div>
      </template>

      <v-card :min-width="300">
        <v-list style="overflow: hidden" lines="two">
          <v-list-item
            density="compact"
            two-line
            :title="store.activePlayer?.display_name.substring(0, 25)"
            :subtitle="
              !store.activePlayer?.powered
                ? $t('state.off')
                : $t('state.' + store.activePlayer?.state)
            "
          >
            <template #prepend>
              <v-icon
                size="50"
                :icon="store.activePlayer.icon"
                color="primary"
              />
            </template>
          </v-list-item>
          <v-divider />
          <VolumeControl
            v-if="store.activePlayer"
            :player="store.activePlayer"
          />
        </v-list>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import api from '@/plugins/api';
import { store } from '@/plugins/store';
import VolumeControl from '@/components/VolumeControl.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import Button from '@/components/mods/Button.vue';
import PlayerVolume from '../PlayerVolume.vue';

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  volumeSize?: string;
  responsiveVolumeSize?: boolean;
  isVisible?: boolean;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  volumeSize: '150px',
  responsiveVolumeSize: true,
  isVisible: true,
  color: '',
});

//refs
const showVolume = ref(false);
</script>

<style scoped>
.volume-control-dialog > .v-overlay__content {
  bottom: 135px !important;
  right: 5px !important;
  left: unset !important;
  top: unset !important;
}
.v-list-item >>> .v-list-item__prepend {
  width: 60px;
  margin-left: -5px;
}
.v-overlay__scrim {
  opacity: 0.4;
}
</style>
