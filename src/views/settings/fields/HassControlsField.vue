<script setup lang="ts">
import HassEntityPickerDialog from "@/components/HassEntityPickerDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ConfigEntryUI, HassControlKey } from "@/helpers/config_entry_ui";
import type { HassControlEntity } from "@/helpers/hass_controls";
import { $t } from "@/plugins/i18n";
import { Plus, X } from "@lucide/vue";
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
  <div class="flex flex-col gap-2 py-2">
    <span class="text-muted-foreground text-sm">{{ label }}</span>
    <div class="flex flex-wrap gap-1.5">
      <Badge v-for="entityId of selected" :key="entityId" variant="secondary">
        {{ entityTitle(entityId) }}
        <button
          v-if="!disabled"
          type="button"
          class="hover:text-foreground ml-1 cursor-pointer"
          :aria-label="$t('settings.hass_controls.remove_entity')"
          @click="remove(entityId)"
        >
          <X class="size-3" />
        </button>
      </Badge>
      <span v-if="selected.length === 0" class="text-muted-foreground text-xs">
        {{ $t("settings.hass_controls.none_selected") }}
      </span>
    </div>
    <div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        :disabled="disabled"
        @click="showPicker = true"
      >
        <Plus class="size-4" />
        {{ $t("settings.hass_controls.add_entity") }}
      </Button>
    </div>
    <HassEntityPickerDialog
      v-model="showPicker"
      :control-type="controlType"
      :added-entity-ids="selected"
      @pick="onPick"
    />
  </div>
</template>
