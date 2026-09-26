<template>
  <div
    class="config-entry"
    :class="{
      'config-entry-advanced': confEntry.advanced,
      'config-entry-hass-picker': isHassControlPickerEntry(confEntry),
    }"
  >
    <ConfigEntryField
      :conf-entry="confEntry"
      :show-password-values="showPasswordValues"
      :disabled="disabled"
      :provider-domain="providerDomain"
      @toggle-password="emit('toggle-password')"
      @update:value="emit('update:value', $event)"
      @action="emit('action')"
      @set-entry-value="
        (key: string, value: ConfigValueType, label?: string) =>
          emit('set-entry-value', key, value, label)
      "
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
    <!-- a description shows in a popover beside the field; a lone docs link has
         nothing to show inline, so it just opens -->
    <Popover v-if="hasDescription">
      <PopoverTrigger as-child>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="help-btn"
          :aria-label="$t('tooltip.help')"
        >
          <HelpCircle class="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        :collision-padding="8"
        class="flex max-h-[60vh] flex-col gap-2 overflow-y-auto text-sm"
      >
        <MarkdownText :text="confEntry.description" />
        <a
          v-if="hasHelpLink"
          :href="helpLink"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary self-start underline underline-offset-2"
        >
          {{ $t("read_more") }}
        </a>
      </PopoverContent>
    </Popover>
    <Button
      v-else-if="hasHelpLink"
      as="a"
      :href="helpLink"
      target="_blank"
      rel="noopener noreferrer"
      variant="ghost"
      size="icon"
      class="help-btn"
      :aria-label="$t('tooltip.help')"
    >
      <HelpCircle class="size-5" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MarkdownText from "@/components/MarkdownText.vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { HelpCircle } from "@lucide/vue";
import {
  ConfigEntryUI,
  isHassControlPickerEntry,
} from "@/helpers/config_entry_ui";
import { getExternalLinkUrl } from "@/helpers/utils";
import { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import ConfigEntryField from "./ConfigEntryField.vue";

const props = defineProps<{
  confEntry: ConfigEntryUI;
  showPasswordValues: boolean;
  disabled: boolean;
  providerDomain?: string;
}>();

const emit = defineEmits<{
  (e: "update:value", value: ConfigValueType): void;
  (e: "toggle-password"): void;
  (e: "action"): void;
  (
    e: "set-entry-value",
    key: string,
    value: ConfigValueType,
    label?: string,
  ): void;
}>();

// description is resolved server-side, or set by the frontend for its own
// settings; an entry carries a description, a docs link, or neither
const hasDescription = computed(() => !!props.confEntry.description?.trim());
// only ever a web URL: getExternalLinkUrl drops other schemes and rewrites the
// docs host on beta builds, matching how provider doc links are opened
const helpLink = computed(() => getExternalLinkUrl(props.confEntry.help_link));
const hasHelpLink = computed(() => !!helpLink.value);
</script>

<style scoped>
.config-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.config-entry:has(+ .config-entry-hass-picker) {
  margin-bottom: 12px;
}

.config-entry:has(+ .config-entry-hass-picker)
  :deep(.v-input__details:not(:has(.v-messages__message))) {
  display: none;
}

.config-entry-hass-picker {
  margin-top: -8px;
  margin-bottom: 16px;
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
