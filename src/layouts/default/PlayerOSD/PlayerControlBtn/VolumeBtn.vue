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
            :player="store.activePlayer!"
            :show-volume-level="false"
            :width="volumeSize"
            :allow-wheel="true"
            style="margin-right: 0px; margin-left: 0px"
          >
            <template #prepend>
              <!-- volume icon + number that opens the popup -->
              <Button
                variant="icon"
                size="48"
                :ripple="false"
                v-bind="{ ...menu }"
              >
                <component
                  :is="volumeIconComponent"
                  :color="props.color ? color : ''"
                  :size="18"
                />
                <div class="text-caption ml-1">
                  {{ Math.round(displayVolume) }}
                </div>
              </Button>
            </template>
          </PlayerVolume>
        </div>
        <div v-else>
          <Button v-bind="{ ...menu }" size="48" variant="icon">
            <component
              :is="volumeIconComponent"
              :color="props.color ? color : ''"
              :size="24"
            />
            <div
              class="text-caption"
              :style="{ color: props.color ? color : '' }"
            >
              {{ Math.round(displayVolume) }}
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
import { getVolumeIconComponent } from "@/helpers/utils";
import { getBreakpointValue } from "@/plugins/breakpoint";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
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
const displayVolume = ref(
  store.activePlayer
    ? Math.round(
        store.activePlayer.group_members.length > 0
          ? (store.activePlayer.group_volume ?? 0)
          : store.activePlayer.volume_level || 0,
      )
    : 0,
);

// Keep displayVolume in sync with the active player's volume
watch(
  () =>
    store.activePlayer
      ? store.activePlayer.group_members.length > 0
        ? (store.activePlayer.group_volume ?? 0)
        : store.activePlayer.volume_level || 0
      : 0,
  (val) => {
    displayVolume.value = Math.round(val ?? 0);
  },
);

// computed
const volumeIconComponent = computed(() => {
  if (!store.activePlayer) return undefined;
  return getVolumeIconComponent(store.activePlayer, displayVolume.value);
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
