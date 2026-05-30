<template>
  <div class="config-entry">
    <ConfigEntryField
      :conf-entry="entry"
      :field="field"
      :field-value="fieldValue"
      :invalid="invalid"
      :errors="errors"
      :show-password-values="showPasswordValues"
      :disabled="disabled"
      class="min-w-0 flex-1"
      @toggle-password="$emit('togglePassword')"
      @action="$emit('action', entry)"
      @open-dsp="$emit('openDsp')"
      @open-options="$emit('openOptions')"
    />

    <div
      v-if="entry.advanced || hasHelp"
      class="flex shrink-0 items-center gap-2 pt-1.5"
    >
      <Badge
        v-if="entry.advanced"
        variant="outline"
        class="text-muted-foreground"
      >
        {{ $t("settings.advanced") }}
      </Badge>

      <TooltipProvider v-if="hasHelp" :delay-duration="150">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="help-btn"
              :aria-label="$t('read_more')"
              @click="entry.help_link && openLink(entry.help_link)"
            >
              <HelpCircle :size="20" />
            </Button>
          </TooltipTrigger>
          <TooltipContent class="max-w-xs text-pretty">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div
              v-if="hasDescription"
              class="[&_a]:underline"
              v-html="descriptionHtml"
            ></div>
            <span v-else>{{ $t("read_more") }}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnyFieldApi } from "@tanstack/form-core";
import { HelpCircle } from "lucide-vue-next";
import { computed } from "vue";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import { markdownToHtml } from "@/helpers/utils";
import type { ConfigValueType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import ConfigEntryField from "./ConfigEntryField.vue";

const props = defineProps<{
  entry: ConfigEntryUI;
  field?: AnyFieldApi;
  fieldValue?: ConfigValueType;
  invalid?: boolean;
  errors?: (string | { message: string | undefined } | undefined)[];
  showPasswordValues: boolean;
  disabled: boolean;
}>();

defineEmits<{
  (e: "action", entry: ConfigEntryUI): void;
  (e: "togglePassword"): void;
  (e: "openDsp"): void;
  (e: "openOptions"): void;
}>();

const description = computed(() =>
  $t(`settings.${props.entry.key}.description`, props.entry.description || ""),
);
const hasDescription = computed(() => !!description.value);
const descriptionHtml = computed(() => markdownToHtml(description.value));

const hasHelp = computed(() => hasDescription.value || !!props.entry.help_link);

const openLink = (url: string) => {
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.click();
};
</script>

<style scoped>
.config-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 12px;
}

.config-entry:last-child {
  margin-bottom: 0;
}

.help-btn {
  opacity: 0.6;
  transition: opacity 0.2s ease;
}

.help-btn:hover {
  opacity: 1;
}
</style>
