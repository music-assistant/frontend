<template>
  <div>
    <Toolbar
      :show-loading="true"
      :enforce-overflow-menu="true"
      :menu-items="menuItems"
      color="background"
      class="editButton"
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
import Container from "@/components/Container.vue";
import HomeWidgetRows from "@/components/HomeWidgetRows.vue";
import Toolbar from "@/components/Toolbar.vue";
import { computed, ref } from "vue";

const editMode = ref(false);

const menuItems = computed(() => {
  return [
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

.editButton {
  float: right;
}
</style>
