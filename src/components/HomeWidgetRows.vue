<template>
  <PlayersWidgetRow
    v-if="widgetRowSettings['players']?.enabled || editMode"
    :settings="widgetRowSettings['players']"
    :edit-mode="editMode"
    @update:settings="(settings) => onUpdateSettings('players', settings)"
  />
  <div
    v-for="widgetRow in widgetRows
      .filter((x) => x.items.length && (x.settings!.enabled || editMode))
      .sort((a, b) => a.settings!.position - b.settings!.position)"
    :key="widgetRow.uri"
  >
    <HomeWidgetRow
      v-if="widgetRows.length"
      :widget-row="widgetRow"
      :edit-mode="editMode"
      @update:settings="
        (settings) => onUpdateSettings(widgetRow.uri!, settings)
      "
    />
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import HomeWidgetRow, {
  WidgetRow,
  WidgetRowSettings,
} from "@/components/WidgetRow.vue";
import PlayersWidgetRow from "./PlayersWidgetRow.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { EventMessage, EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

const widgetRows = ref<WidgetRow[]>([]);
const widgetRowSettings = ref<Record<string, WidgetRowSettings>>({});

export interface Props {
  editMode?: boolean;
}
withDefaults(defineProps<Props>(), {
  editMode: false,
});

const loadData = async function () {
  const widgetRowSettingsRaw = localStorage.getItem("widgetRowSettings");
  widgetRowSettings.value = widgetRowSettingsRaw
    ? JSON.parse(widgetRowSettingsRaw)
    : {
        // insert virtual row for players
        players: {
          position: 0,
          enabled: true,
        },
      };

  const recommendations = await api.getRecommendations();
  const _widgetRows: WidgetRow[] = [];
  let idx = 0;
  for (const recommendation of recommendations) {
    idx++;
    const settings = widgetRowSettings.value[recommendation.uri] || {
      position: idx,
      enabled: true,
    };
    const title = recommendation.translation_key
      ? $t(
          `recommendations.${recommendation.translation_key}`,
          recommendation.name,
        )
      : recommendation.name;
    _widgetRows.push({
      ...recommendation,
      settings,
      title,
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
  widgetRowSettings.value[uri] = settings;
  localStorage.setItem(
    "widgetRowSettings",
    JSON.stringify(widgetRowSettings.value),
  );
};
</script>

<style></style>
