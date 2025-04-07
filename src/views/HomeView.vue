<template>
  <div>
    <Toolbar
      title="Music Assistant"
      :show-loading="true"
      :enforce-overflow-menu="true"
      :menu-items="menuItems"
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
import { computed, ref } from "vue";
import router from "@/plugins/router";

const hideSettings = ref(
  localStorage.getItem("frontend.settings.hide_settings") == "true",
);

const editMode = ref(false);

const menuItems = computed(() => {
  return [
    {
      label: "settings.settings",
      icon: "mdi-cog-outline",
      action: () => {
        router.push({ path: "settings" });
      },
      hide: hideSettings.value,
    },
    {
      label: editMode.value
        ? "homescreen_edit_disable"
        : "homescreen_edit_enable",
      icon: "mdi-pencil",
      action: () => {
        editMode.value = !editMode.value;
      },
    },
  ];
});
</script>

<style scoped>
.v-progress-circular {
  display: block;
  margin-inline: auto;
}
</style>
