<template>
  <v-app-bar color="grey-darken-3" density="compact" style="height: 56px">
    <template v-slot:prepend>
      <v-icon size="40">mdi-play-circle</v-icon>
    </template>
    <v-app-bar-title
      >{{ store.topBarTitle || "Music Assistant" }}
      <span v-if="store.topBarSubTitle" style="opacity: 0.5"> | {{
        store.topBarSubTitle
      }}</span></v-app-bar-title
    >

    <template v-slot:append>
      <div style="align-items: right; display: flex">
        <v-tooltip location="top end" origin="end center">
          <template #activator="{ props: tooltip }">
            <v-progress-circular
              v-if="api.syncTasks.value.length > 0 || store.loading"
              indeterminate
              v-bind="tooltip"
            />
          </template>
          <span v-if="api.syncTasks.value.length > 0">{{ $t("jobs_running", [api.syncTasks.value.length]) }}</span>
        </v-tooltip>
      </div>
      <div style="align-items: right; display: flex">
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn
              v-if="store.topBarContextMenuItems.length > 0"
              icon="mdi-dots-vertical"
              style="margin-right: -18px"
              v-bind="props"
              variant="plain"
            />
          </template>

          <v-list>
            <v-list-item
              v-for="(item, index) in store.topBarContextMenuItems"
              :key="index"
              :title="$t(item.label, item.labelArgs)"
              @click="item.action ? item.action() : ''"
            >
              <template #prepend>
                <v-avatar :icon="item.icon" />
              </template>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-app-bar>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { store } from "@/plugins/store";
import { api } from "@/plugins/api";

const router = useRouter();
const dialog = ref(false);

const backButton = function () {
  const prevRoute = store.prevRoutes.pop();
  if (prevRoute) {
    prevRoute.params["backnav"] = "true";
    router.replace(prevRoute).then(() => {
      setTimeout(() => {
        window.scrollTo(0, prevRoute.meta.scrollPos || 0);
      }, 400);
    });
  }
};
</script>

<style>
.padded-overlay .v-overlay__content {
  padding: 50px;
}
.v-overlay__scrim {
  opacity: 65%;
}
</style>
