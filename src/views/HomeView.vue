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
import { ref } from "vue";

export interface Props {
  player?: string;
}
const props = defineProps<Props>();

const hideSettings = ref(
  localStorage.getItem("frontend.settings.hide_settings") == "true",
);

</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
}
</style>
