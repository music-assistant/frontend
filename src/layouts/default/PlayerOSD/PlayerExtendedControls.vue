<template>
  <!-- active queue -->
  <Button
    v-if="props.visibleComponents && props.visibleComponents.queue?.isVisible"
    icon
    v-bind="props.visibleComponents.queue.icon"
    @click="
      store.showFullscreenPlayer = false;
      props.showQueueDialog
        ? // eslint-disable-next-line vue/no-mutating-props
          (props.showQueueDialog = true)
        : router.push('/playerqueue/');
    "
  >
    <v-icon icon="mdi-playlist-play" />
  </Button>
  <!-- active player -->
  <Button
    v-if="props.visibleComponents && props.visibleComponents.player?.isVisible"
    :icon="getBreakpointValue('bp6') ? false : true"
    v-bind="props.visibleComponents.player.icon"
    @click="store.showPlayersMenu = true"
  >
    <v-badge
      v-if="curGroupPlayers && curGroupPlayers.length > 0"
      size="small"
      :content="store.selectedPlayer?.group_childs.length"
      :color="$vuetify.theme.current.dark ? store.coverImageColorCode.lightColor : store.coverImageColorCode.darkColor"
    >
      <v-icon
        :color="
          !getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) &&
          isColorDark(store.coverImageColorCode.darkColor)
            ? '#000'
            : '#fff'
        "
        :size="24"
        >mdi-speaker</v-icon
      >
    </v-badge>
    <v-icon
      v-else
      :color="
        !getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) && isColorDark(store.coverImageColorCode.darkColor)
          ? '#000'
          : '#fff'
      "
      :size="24"
      >mdi-speaker</v-icon
    >
    <div v-if="activePlayerQueue && getBreakpointValue('bp6')" class="line-clamp-1">
      {{ truncateString(activePlayerQueue?.display_name, 8) }}
    </div>
  </Button>

  <!-- active player volume -->
  <div v-if="props.visibleComponents && props.visibleComponents.volume?.isVisible">
    <v-menu v-if="activePlayerQueue" v-model="showVolume" class="volume-control-dialog" :close-on-content-click="false">
      <template #activator="{ props: menu }">
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
              <Button icon v-bind="{ ...menu, ...props.visibleComponents.volume.icon }">
                <v-icon
                  icon="mdi-volume-high"
                  :color="
                    !getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) &&
                    isColorDark(store.coverImageColorCode.darkColor)
                      ? '#000'
                      : '#fff'
                  "
                />
                <div class="text-caption">
                  {{
                    store.selectedPlayer!.group_childs.length > 0
                      ? Math.round(store.selectedPlayer?.group_volume || 0)
                      : Math.round(store.selectedPlayer?.volume_level || 0)
                  }}
                </div>
              </Button>
            </template>
          </PlayerVolume>
        </div>
        <div v-else>
          <Button v-bind="{ ...menu, ...props.visibleComponents.volume.icon }" icon>
            <v-icon
              icon="mdi-volume-high"
              :color="
                !getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) &&
                isColorDark(store.coverImageColorCode.darkColor)
                  ? '#000'
                  : '#fff'
              "
            />
            <div
              class="text-caption"
              :style="{
                cursor: 'pointer',
                color:
                  !getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) &&
                  isColorDark(store.coverImageColorCode.darkColor)
                    ? '#000'
                    : '#fff',
              }"
            >
              {{
                store.selectedPlayer!.group_childs.length > 0
                  ? Math.round(store.selectedPlayer?.group_volume || 0)
                  : Math.round(store.selectedPlayer?.volume_level || 0)
              }}
            </div>
          </Button>
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
                color="primary"
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

import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/mods/ListItem.vue';
import Button from '@/components/mods/Button.vue';
import { ResponsiveIconProps } from '@/components/mods/ResponsiveIcon.vue';
import { isColorDark, truncateString } from '@/helpers/utils';

const router = useRouter();

// properties
export interface Props {
  // eslint-disable-next-line vue/require-default-prop
  volumeSize?: string;
  responsiveVolumeSize?: boolean;
  showQueueDialog?: boolean;
  visibleComponents?: {
    queue?: {
      isVisible?: boolean;
      icon?: ResponsiveIconProps;
    };
    player?: {
      isVisible?: boolean;
      icon?: ResponsiveIconProps;
    };
    volume?: {
      isVisible?: boolean;
      icon?: ResponsiveIconProps;
    };
  };
}

const props = withDefaults(defineProps<Props>(), {
  volumeSize: '150px',
  responsiveVolumeSize: true,
  showQueueDialog: false,
  visibleComponents: () => ({
    queue: { isVisible: true },
    player: { isVisible: true },
    volume: { isVisible: true },
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

const curGroupPlayers = computed(() => {
  if (store.selectedPlayer) {
    return store.selectedPlayer.group_childs;
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
