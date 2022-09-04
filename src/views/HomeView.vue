<template>
  <div>
    <div
      style="
        margin-left: 10px;
        margin-right: 10px;
        margin-top: 20px;
        margin-bottom: 20px;
      "
    >
      <GlobalSearch />
      <!-- search artists -->
      <!-- <v-card
        v-if="searchArtists.length > 0"
        style="margin-top: 20px; margin-bottom: 20px"
      >
        <v-card-title style="margin-left: 15px">{{
          $t("artists")
        }}</v-card-title>
        <v-slide-group
          show-arrows="always"
          style="margin-left: 5px; margin-right: 5px; margin-bottom: 10px"
        >
          <v-slide-group-item v-for="item in searchArtists" :key="item.uri">
            <PanelviewItem
              :item="item"
              :size="thumbSize"
              :is-selected="false"
              :show-checkboxes="false"
              style="margin: 5px"
            />
          </v-slide-group-item>
        </v-slide-group>
      </v-card> -->

      <!-- regular menu items -->
      <div style="margin-top: 20px">
        <v-row dense align-content="start" :align="'start'">
          <v-col v-for="card in cards" :key="card.label" align-self="start">
            <v-card
              class="mx-auto"
              outlined
              :align="'center'"
              min-width="150"
              max-width="350"
              @click="$router.push(card.path)"
            >
              <v-list-item
                two-line
                style="padding-left: 8px; padding-right: 8px"
              >
                <v-list-item-content>
                  <v-row>
                    <v-col>
                      <v-card style="border: none;" class="pa-2" tile>
                        <v-btn variant="plain" :ripple="false" icon height="75">
                          <v-icon
                            :icon="card.icon"
                            size="75"
                            style="align: center;"
                          />
                        </v-btn>
                      </v-card>
                    </v-col>
                  </v-row>
                  <v-row style="padding-bottom: 20px">
                    <v-col>
                      <v-toolbar-subtitle>{{
                        $t(card.label)
                      }}</v-toolbar-subtitle>
                    </v-col>
                  </v-row>
                </v-list-item-content>
              </v-list-item>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  mdiAccountMusic,
  mdiAlbum,
  mdiFileMusic,
  mdiMagnify,
  mdiPlaylistMusic,
  mdiRadio,
  mdiFolder,
  mdiFileSync,
  mdiCached,
} from '@mdi/js';
import { ref, computed, onBeforeUnmount, watch } from 'vue';
import { store } from '../plugins/store';
import PanelviewItem from '../components/PanelviewItem.vue';
import GlobalSearch from '../components/GlobalSearch.vue';

import { api, type MediaItemType } from '@/plugins/api';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';

const { mobile } = useDisplay();
const searchHasFocus = ref(false);

store.topBarTitle = store.defaultTopBarTitle;
store.topBarContextMenuItems = [
  {
    label: 'sync',
    labelArgs: [],
    action: () => {
      api.startSync(undefined, undefined);
    },
    icon: mdiFileSync,
  },
  {
    label: 'sync_full',
    labelArgs: [],
    action: () => {
      api.startSync(undefined, undefined, true);
    },
    icon: mdiCached,
  },
];
onBeforeUnmount(() => {
  store.topBarContextMenuItems = [];
});

const thumbSize = computed(() => {
  return mobile.value ? 100 : 150;
});

const cards = ref([
  {
    label: 'artists',
    icon: mdiAccountMusic,
    path: '/artists',
  },
  {
    label: 'albums',
    icon: mdiAlbum,
    path: '/albums',
  },
  {
    label: 'tracks',
    icon: mdiFileMusic,
    path: '/tracks',
  },
  {
    label: 'playlists',
    icon: mdiPlaylistMusic,
    path: '/playlists',
  },
  {
    label: 'radios',
    icon: mdiRadio,
    path: '/radios',
  },
  {
    label: 'browse',
    icon: mdiFolder,
    path: '/browse',
  },
]);
</script>

<style>
div.v-slide-group__next {
  position: absolute;
  right: -5px;
  min-width: 40px;
  height: 30px;
  align-items: start;
  margin-top: -35px;
}

div.v-slide-group__prev {
  position: absolute;
  left: -5px;
  min-width: 40px;
  height: 30px;
  align-items: start;
  margin-top: -35px;
}
.v-expansion-panel-title {
  border-radius: 0px;
}
</style>
