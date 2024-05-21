<template>
  <div>
    <Toolbar
      title="Music Assistant"
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

    <Container v-if="api.setUpCompleted.value" variant="panel">
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
import { ref } from 'vue';
import api from '@/plugins/api';
const hideSettings = ref(
  localStorage.getItem('frontend.settings.hide_settings') == 'true',
);
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
}
</style>
