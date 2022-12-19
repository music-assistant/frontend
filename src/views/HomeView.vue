<template>
  <div>
    <div
      style="
        margin-left: 10px;
        margin-right: 10px;
        margin-top: 10px;
        margin-bottom: 10px;
      "
    >
      <div>
        <v-row dense align-content="start" :align="'start'">
          <v-col v-for="card in cards" :key="card.label" align-self="start">
            <v-card
              :ripple="true"
              class="mx-auto home-card"
              outlined
              @click="$router.push(card.path)"
            >
              <v-btn variant="plain" :ripple="false" icon height="75">
                <v-icon :icon="card.icon" size="75" />
              </v-btn>
              <v-card-title class="home-card-title">{{
                $t(card.label)
              }}</v-card-title>
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
  mdiPlaylistMusic,
  mdiRadio,
  mdiFolder,
} from '@mdi/js';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { store } from '../plugins/store';

store.topBarTitle = store.defaultTopBarTitle;

onMounted(() => {
  store.showTabsNav = false;
});

onBeforeUnmount(() => {
  store.showTabsNav = true;
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
.home-card {
  min-width: 150px;
  text-align: center;
  padding-top: 12px;
  padding-bottom: 8px;
}

.home-card-title {
  line-height: 1.5 !important;
  font-size: 1rem !important;
  font-weight: 400 !important;
}

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
