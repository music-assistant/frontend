<script setup lang="ts">
import HassEntityPickerDialog from "@/components/HassEntityPickerDialog.vue";
import type { ConfigEntryUI, HassControlKey } from "@/helpers/config_entry_ui";
import type { HassControlEntity } from "@/helpers/hass_controls";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";

const props = defineProps<{
  entry: ConfigEntryUI;
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: string[]] }>();

const showPicker = ref(false);

const controlType = computed(() => props.entry.key as HassControlKey);

const selected = computed(() => (props.entry.value ?? []) as string[]);

// the entity name is only known while the server still ships the options; the entity ID
// it falls back to identifies the entity just as unambiguously
const entityTitle = (entityId: string) =>
  props.entry.options
    ?.find((option) => option.value === entityId)
    ?.title?.toString() || entityId;

const onPick = (entity: HassControlEntity) => {
  if (selected.value.includes(entity.entity_id)) return;
  emit("update:value", [...selected.value, entity.entity_id]);
};

const remove = (entityId: string) => {
  emit(
    "update:value",
    selected.value.filter((id) => id !== entityId),
  );
};
</script>

<template>
  <div class="hass-controls">
    <v-label class="hass-controls-label">{{ label }}</v-label>
    <div class="hass-controls-selection">
      <v-chip
        v-for="entityId of selected"
        :key="entityId"
        size="small"
        :closable="!disabled"
        :disabled="disabled"
        @click:close="remove(entityId)"
      >
        {{ entityTitle(entityId) }}
      </v-chip>
      <span v-if="selected.length === 0" class="hass-controls-empty">
        {{ $t("settings.hass_controls.none_selected") }}
      </span>
    </div>
    <div>
      <v-btn
        variant="outlined"
        size="small"
        :disabled="disabled"
        @click="showPicker = true"
      >
        {{ $t("settings.hass_controls.add_entity") }}
      </v-btn>
    </div>
    <HassEntityPickerDialog
      v-model="showPicker"
      :control-type="controlType"
      :added-entity-ids="selected"
      @pick="onPick"
    />
  </div>
</template>

<style scoped>
.hass-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.hass-controls-label {
  font-size: 0.875rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.hass-controls-selection {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hass-controls-empty {
  font-size: 0.813rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
