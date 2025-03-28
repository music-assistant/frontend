<template>
  <div>
    <Toolbar
      title="Music Assistant"
      :show-loading="true"
      :enforce-overflow-menu="true"
      :menu-items="
        hideSettings
          ? [editModeMenuBtn]
          : [
              {
                label: 'settings.settings',
                icon: 'mdi-cog-outline',
                action: () => {
                  $router.push({ path: 'settings' });
                },
              },
              editModeMenuBtn,
            ]
      "
    />

    <Container variant="panel">
      <Suspense>
        <div>
          <HomeWidgetRows :edit-mode="editMode" />
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

const hideSettings = ref(
  localStorage.getItem("frontend.settings.hide_settings") == "true",
);

const editMode = ref(false);

const editModeMenuBtn = {
  label: "homescreen_edit",
  icon: "mdi-pencil",
  action: () => {
    editMode.value = !editMode.value;
  },
};
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
}
</style>
