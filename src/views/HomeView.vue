<template>
  <div>
    <div style="margin-left: 10px; margin-right: 10px; margin-top: 10px; margin-bottom: 10px">
      <div>
        <v-row dense align-content="start" :align="'start'">
          <v-col v-for="card in cards" :key="card.label" align-self="start">
            <v-card :ripple="true" class="mx-auto home-card" outlined @click="$router.push(card.path)">
              <v-list-item two-line>
                <v-btn variant="plain" icon :ripple="false" height="80">
                  <v-icon :icon="card.icon" size="80" style="align: center; padding: 10px" />
                </v-btn>
                <div class="mb-4">
                  <h5>{{ $t(card.label) }}</h5>
                </div>
              </v-list-item>
            </v-card>
          </v-col>
        </v-row>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const cards = ref([
  {
    label: 'artists',
    icon: 'mdi-account-music',
    path: '/artists',
  },
  {
    label: 'albums',
    icon: 'mdi-album',
    path: '/albums',
  },
  {
    label: 'tracks',
    icon: 'mdi-file-music',
    path: '/tracks',
  },
  {
    label: 'radios',
    icon: 'mdi-radio',
    path: '/radios',
  },
  {
    label: 'playlists',
    icon: 'mdi-playlist-music',
    path: '/playlists',
  },
  {
    label: 'browse',
    icon: 'mdi-folder',
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
</style>
