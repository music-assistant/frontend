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
        <v-row
          dense
          align-content="start"
          :align="'start'"
        >
          <v-col
            v-for="card in cards"
            :key="card.label"
            align-self="start"
          >
            <v-card
              :ripple="true"
              class="mx-auto home-card"
              outlined
              @click="$router.push(card.path)"
            >
              <v-list-item two-line>
                <v-btn
                  variant="plain"
                  icon
                  :ripple="false"
                  height="80"
                >
                  <v-icon
                    :icon="card.icon"
                    size="80"
                    style="align: center; padding: 10px"
                  />
                </v-btn>
                <div class="mb-4">
                  {{ $t(card.label) }}
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
import { ref, onMounted } from 'vue';

import { api } from '@/plugins/api';
import { Artist } from '@/plugins/api/interfaces';

const recentArtists = ref<Artist[]>([]);

onMounted(async () => {
  const result = await api.getAlbumArtists(undefined, undefined, 25, 0, "timestamp_added");
  recentArtists.value = result.items as Artist[];
});

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
