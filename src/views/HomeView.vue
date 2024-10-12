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
          <HomeWidgetRows />
        </div>
        <template #fallback><v-progress-circular indeterminate /> </template>
      </Suspense>
    </Container>
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/mods/Container.vue";
import HomeWidgetRows from "@/components/HomeWidgetRows.vue";
import Toolbar from "@/components/Toolbar.vue";
import { ref, watch } from "vue";
import { store } from "@/plugins/store";
import api from "@/plugins/api";

export interface Props {
  player?: string;
}
const props = defineProps<Props>();

const hideSettings = ref(
  localStorage.getItem("frontend.settings.hide_settings") == "true",
);

const urlParams = new URLSearchParams(window.location.search);
console.log(urlParams.toString());

watch(
  () => props.player,
  (val) => {
    console.error("props.player", val);
    if (!val || val == "false") return;
    if (typeof val === "string") {
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
