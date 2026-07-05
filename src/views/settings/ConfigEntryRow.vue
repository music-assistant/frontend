<template>
  <div
    class="config-entry"
    :class="{ 'config-entry-advanced': confEntry.advanced }"
  >
    <ConfigEntryField
      :conf-entry="confEntry"
      :show-password-values="showPasswordValues"
      :disabled="disabled"
      @toggle-password="emit('toggle-password')"
      @update:value="emit('update:value', $event)"
      @action="emit('action')"
      @open-dsp="emit('open-dsp')"
      @open-options="emit('open-options')"
    />
    <v-chip
      v-if="confEntry.advanced"
      size="x-small"
      color="grey"
      variant="outlined"
      class="advanced-badge"
    >
      {{ $t("settings.advanced") }}
    </v-chip>
    <Button
      v-if="hasDescriptionOrHelpLink"
      type="button"
      variant="ghost"
      size="icon"
      class="help-btn"
      :aria-label="$t('tooltip.help')"
      @click="emit('help')"
    >
      <HelpCircle :size="20" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "@lucide/vue";
import { ConfigEntryUI } from "@/helpers/config_entry_ui";
import { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import ConfigEntryField from "./ConfigEntryField.vue";

const props = defineProps<{
  confEntry: ConfigEntryUI;
  showPasswordValues: boolean;
  disabled: boolean;
}>();

const emit = defineEmits<{
  (e: "update:value", value: ConfigValueType): void;
  (e: "toggle-password"): void;
  (e: "action"): void;
  (e: "open-dsp"): void;
  (e: "open-options"): void;
  (e: "help"): void;
}>();

const hasDescriptionOrHelpLink = computed(() => {
  const entry = props.confEntry;
  // description is resolved server-side (or set by the frontend for its own settings); the entry
  // either has one, or a help link
  return ((entry.description || entry.help_link || " ")?.length ?? 0) > 1;
});
</script>

<style scoped>
.config-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.config-entry:last-child {
  margin-bottom: 0;
}

/* Add extra top margin for entries that follow a checkbox (which is shorter) */
.config-entry:has(.v-checkbox) + .config-entry:has(.v-text-field),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-select),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-slider),
.config-entry:has(.v-checkbox) + .config-entry:has(.v-combobox) {
  margin-top: 16px;
}

/* Advanced entry styling */
.config-entry-advanced {
  opacity: 0.9;
}

/* Advanced badge */
.advanced-badge {
  margin-left: 8px;
  margin-top: 8px;
  flex-shrink: 0;
  height: 20px;
}

/* Help button */
.help-btn {
  flex-shrink: 0;
  margin-top: 8px;
  opacity: 0.6;
  transition: opacity 0.2s ease;
  height: 36px;
}

.help-btn:hover {
  opacity: 1;
}

@media (min-width: 601px) {
  .config-entry:has(.config-slider-wrapper) .help-btn {
    margin-top: 0;
    align-self: center;
  }
}

@media (max-width: 600px) {
  .config-entry:has(.config-slider-wrapper) .help-btn {
    align-self: flex-start;
    margin-top: 0;
  }
}
</style>
