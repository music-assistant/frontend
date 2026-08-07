<script setup lang="ts">
import HassEntityPickerDialog from "@/components/HassEntityPickerDialog.vue";
import { Button } from "@/components/ui/button";
import type { HassControlPickerEntry } from "@/helpers/config_entry_ui";
import {
  addHassControlEntity,
  type HassControlEntity,
} from "@/helpers/hass_controls";
import { $t } from "@/plugins/i18n";
import { Plus } from "@lucide/vue";
import { ref } from "vue";

const props = defineProps<{
  entry: HassControlPickerEntry;
  disabled?: boolean;
}>();

const emit = defineEmits<{ setEntryValue: [key: string, value: string] }>();

const showPicker = ref(false);
const saving = ref(false);

const onPick = async (entity: HassControlEntity) => {
  saving.value = true;
  try {
    // registering the entity with the Home Assistant provider is what makes it selectable
    // as a control, so it is stored right away; the player entry itself is only filled in
    // on the form and persists when the user saves
    await addHassControlEntity(
      props.entry.hass_instance_id,
      props.entry.hass_control_key,
      entity.entity_id,
    );
    emit("setEntryValue", props.entry.target_key, entity.entity_id);
  } catch {
    // the API layer reports the failure; leaving the entry untouched keeps the form in
    // step with what the provider actually holds
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div>
    <Button
      variant="ghost"
      size="sm"
      class="text-primary -ml-2"
      :disabled="disabled || saving"
      @click="showPicker = true"
    >
      <Plus class="size-4" />
      {{ $t("settings.hass_controls.add_hass_entity") }}
    </Button>
    <HassEntityPickerDialog
      v-model="showPicker"
      :control-type="entry.hass_control_key"
      @pick="onPick"
    />
  </div>
</template>
