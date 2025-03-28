<template>
  <div
    v-for="widgetRow in widgetRows
      .filter((x) => x.settings!.enabled || editMode)
      .sort((a, b) => a.settings!.position - b.settings!.position)"
    :key="widgetRow.uri"
  >
    <HomeWidgetRow
      v-if="widgetRows.length"
      :widget-row="widgetRow"
      :edit-mode="editMode"
      @update:settings="(settings) => onUpdateSettings(widgetRow.uri, settings)"
    />
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import HomeWidgetRow, {
  WidgetRow,
  WidgetRowSettings,
} from "@/components/WidgetRow.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { EventMessage, EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

const widgetRows = ref<WidgetRow[]>([]);

export interface Props {
  editMode?: boolean;
}
withDefaults(defineProps<Props>(), {
  editMode: false,
});

const loadData = async function () {
  const widgetRowSettingsRaw = localStorage.getItem("widgetRowSettings");
  const widgetRowSettings: Record<string, WidgetRowSettings> =
    widgetRowSettingsRaw ? JSON.parse(widgetRowSettingsRaw) : {};
  const recommendations = await api.getRecommendations();
  const _widgetRows: WidgetRow[] = [];
  let idx = 0;
  for (const recommendation of recommendations) {
    idx++;
    const settings = widgetRowSettings[recommendation.uri] || {
      position: idx,
      enabled: true,
    };
    const label = recommendation.translation_key
      ? $t(
          `recommendations.${recommendation.translation_key}`,
          recommendation.name,
        )
      : recommendation.name;
    _widgetRows.push({
      ...recommendation,
      settings,
      label,
    });
    widgetRows.value = _widgetRows;
  }
};

onMounted(() => {
  loadData();
  // signal if/when an item is played (to refresh recommendations)
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_PLAYED,
    async (evt: EventMessage) => {
      if (evt.data && !evt.data.is_playing) {
        loadData();
      }
    },
  );
  onBeforeUnmount(unsub);
});

const onUpdateSettings = function (uri: string, settings: WidgetRowSettings) {
  // update the item in-place of the list
  for (const widgetRow of widgetRows.value) {
    if (widgetRow.uri === uri) {
      widgetRow.settings = settings;
      break;
    }
  }
  // update persistent settings
  const widgetRowSettingsRaw = localStorage.getItem("widgetRowSettings");
  const widgetRowSettings: Record<string, WidgetRowSettings> =
    widgetRowSettingsRaw ? JSON.parse(widgetRowSettingsRaw) : {};
  widgetRowSettings[uri] = settings;
  localStorage.setItem("widgetRowSettings", JSON.stringify(widgetRowSettings));
};
</script>

<style></style>
