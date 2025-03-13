<template>
  <div v-for="recommendation in recommendations" :key="recommendation.uri">
    <HomeWidgetRow
      v-if="recommendation.items.length"
      :widget-row="{
        label: recommendation.translation_key
          ? $t(recommendation.translation_key, recommendation.name)
          : recommendation.name,
        items: recommendation.items,
        icon: recommendation.icon!,
      }"
    />
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import HomeWidgetRow, { WidgetRow } from "@/components/HomeWidgetRow.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { onActivated } from "vue";
import {
  EventMessage,
  EventType,
  RecommendationFolder,
} from "@/plugins/api/interfaces";

const recommendations = ref<RecommendationFolder[]>([]);

const loadData = async function () {
  recommendations.value = await api.getRecommendations();
};

await loadData();

onActivated(() => {
  // update the listing when a cached view is reactivated
  loadData();
});

onMounted(() => {
  // signal if/when an item gets played (or is playing)
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_PLAYED,
    async (evt: EventMessage) => {
      // update the recently played and in-progress widget rows
      // widgetRows.value.recently_played.items =
      //   await api.getRecentlyPlayedItems(10);
      // widgetRows.value.in_progress_items.items =
      //   await api.getInProgressItems(10);
    },
  );
  onBeforeUnmount(unsub);
});
</script>

<style></style>
