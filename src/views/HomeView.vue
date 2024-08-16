<template>
  <div>
    <Toolbar
      title="Music Assistant"
      :show-loading="true"
      :menu-items="
        hideSettings
          ? []
          : [
              {
                label: 'settings.settings',
                icon: 'mdi-cog-outline',
                action: () => {
                  $router.push({ path: 'settings' });
                },
              },
            ]
      "
    />

    <Container variant="panel">
      <Suspense>
        <div>
          <HomeCurrentlyPlayingRow />
          <HomeWidgetRows />
        </div>
        <template #fallback><v-progress-circular indeterminate /> </template>
      </Suspense>
    </Container>
  </div>
</template>

<script setup lang="ts">
import Container from '@/components/mods/Container.vue';
import HomeWidgetRows from '@/components/HomeWidgetRows.vue';
import Toolbar from '@/components/Toolbar.vue';
import HomeCurrentlyPlayingRow from '@/components/HomeCurrentlyPlayingRow.vue';
import { ref, watch } from 'vue';
import { store } from '@/plugins/store';
import api from '@/plugins/api';

export interface Props {
  player?: string;
}
const props = defineProps<Props>();

const hideSettings = ref(
  localStorage.getItem('frontend.settings.hide_settings') == 'true',
);

console.log(window.location.href);
const url =
  'https://deezer.oauth.jonathanbangert.com/http%3A%2F%2F192.168.1.4%3A8096%2Fcallback%2Fra4zYWuDsDu?code=AQDITszGGPJgyjGJpQKi5uxwzS4IlCg9PlclwaM9VlgXianotmp8bjXUPj88GCVNtw2dU0GBD1xTAcslWgfZ3MKrkpo04n0RRZlIOD9kq7c7TnTZYQO5D0Is_N7u6eCg_cpSbfTXHk_6jNgYeq0vo4JS9KdRKdEZ8RUDwIoFa7DrR9GZ3Tm8jFLCy-uMxkCPG43SCV2n-y2Ravha-ThKXL5BR2UjzkUoI3N6T1rhP7cXTAeqnHdFGw3y7JPJQGgn352CXx79MAF3znM3WatvDmYiHpNyoS5_dJ6Hy1uNeqVfmRDtZssKipj3HRRzFmTSm1x3YJ7a9Pobg22a4qmKADQ4Mj3aaEo87V1WbrdS-ZSibZtIQirRqSnUxkB-Oa_BueSQBoCGpvqcIUeuA3sJhbLXVqriDDcrpRokIN8gULOhtoNvAGLMgYME4DIhMY5A0WXlbp5ZLGUNlEBpaPzBrK-chucgIfqBrkyvHa1-OVLgUWvt8sG11X1XOoswydI_IRFXSZ9fxZgmTxCDTr6rE9GMAm6oF0GbjGI5VV1Vyh0OieppYpxJCTUGCsEV2VhY1lDufEigiUo_iVo8zYfxEygB099Bx0CxhHmNVEctotmU-_7yYkVQHG37h8jl7ZyAUI6MNJgenBVgrukJAyzbBfr-qxAFbwWgOA';
console.log('url_org', url);
const redirect_url = decodeURIComponent(url.split('/', 4)[3]);
console.log('redirect_url', redirect_url);

const urlParams = new URLSearchParams(window.location.search);
console.log(urlParams.toString());

watch(
  () => props.player,
  (val) => {
    console.error('props.player', val);
    if (!val || val == 'false') return;
    if (typeof val === 'string') {
      // val can be either player id or player name
      if (val in api.players) {
        store.activePlayerId = api.players[val].player_id;
      } else {
        for (const player of Object.values(api.players)) {
          if (player.display_name.toLowerCase() === val.toLowerCase()) {
            store.activePlayerId = player.player_id;
            break;
          }
        }
      }
    }
    store.showFullscreenPlayer = true;
  },
  { immediate: true },
);
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
}
</style>
