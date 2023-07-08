<template>
  <Container>
    <div class="content-spacing">
      <HomeArea :title="$t('currently_playing')">
        <v-row row="6">
          <v-col v-if="currentPlayingPlayers.length <= 0" style="text-align: center">
            <div>No media is playing</div>
          </v-col>
          <v-col v-for="player in currentPlayingPlayers" :key="player.player_id">
            <MediaItemCard :queue-id="player.player_id" />
          </v-col>
        </v-row>
      </HomeArea>

      <HomeArea title="Recently Played" />

      <HomeArea
        v-for="config in providerConfigs
          .filter((x) => x.domain in api.providers)
          .filter((x) => x.type === ProviderType.MUSIC)
          .sort((a, b) =>
            (a.name || api.providers[a.domain].name).toUpperCase() >
            (b.name || api.providers[b.domain].name).toUpperCase()
              ? 1
              : -1,
          )"
        :key="config.instance_id"
        :title="`Popular on ${config.name}`"
      />
    </div>
  </Container>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';

import { api } from '@/plugins/api';
import { EventType, Player, ProviderConfig, ProviderManifest, ProviderType, Artist } from '@/plugins/api/interfaces';
import MediaItemCard from '@/components/MediaItemCard.vue';
import HomeArea from '@/components/HomeArea.vue';
import Container from '@/components/mods/Container.vue';

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);
const recentArtists = ref<Artist[]>([]);
const currentPlayingPlayers = ref<Player[]>([]);

onMounted(async () => {
  const result = await api.getAlbumArtists(undefined, undefined, 25, 0, 'timestamp_added');
  recentArtists.value = result.items as Artist[];
});

// listen for item updates to refresh items when that happens
const unsub = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
  loadItems();
});
onBeforeUnmount(unsub);

// methods
const loadItems = async function () {
  providerConfigs.value = await api.getData('config/providers');
  const manifests: ProviderManifest[] = await api.getData('providers/available');
  for (const prov of manifests) {
    api.providerManifests[prov.domain] = prov;
  }
};

// watchers
watch(
  () => api.providers,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);

watch(
  () => api.providers,
  async () => {
    const players = await api.getPlayers();
    for (const player of players) {
      if (player.state === 'playing') {
        if (!currentPlayingPlayers.value.find(({ player_id }) => player_id === player.player_id))
          currentPlayingPlayers.value.push(player);
      }
    }
  },
  { immediate: true },
);
</script>
