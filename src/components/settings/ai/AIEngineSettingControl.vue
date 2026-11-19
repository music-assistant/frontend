<template>
  <div
    class="flex items-center gap-2 max-sm:w-full max-sm:pl-9"
    :aria-busy="busy"
    :data-testid="`ai-engine-picker-${engineSettingKey(setting)}`"
  >
    <Spinner v-if="busy" class="size-4 shrink-0" />
    <div class="w-full sm:w-80 [&_.v-input\_\_details]:hidden">
      <ConfigEntryField
        v-if="entry"
        :conf-entry="entry"
        :show-password-values="false"
        :disabled="busy"
        :clearable="false"
        @update:value="pick"
      />
      <span
        v-else-if="loadFailed"
        class="text-muted-foreground block text-sm sm:text-right"
      >
        {{ state }}
      </span>
      <Skeleton v-else class="h-12 w-full rounded-md" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useConfigValue } from "@/composables/useConfigValue";
import { engineSettingKey, engineSettingOwner } from "@/helpers/ai_settings";
import type { AIEngineUsage, ConfigValueType } from "@/plugins/api/interfaces";
import ConfigEntryField from "@/views/settings/ConfigEntryField.vue";
import { watch } from "vue";

/**
 * The picker of the engine an engine setting uses, as the core module or
 * provider owning the setting offers it, saving a pick right away.
 */
const props = defineProps<{
  setting: AIEngineUsage;
  // the engine the setting uses, shown when its picker cannot be loaded
  state: string;
}>();

const emit = defineEmits<{
  // a new engine was saved for the setting
  saved: [setting: AIEngineUsage];
}>();

const { entry, loadFailed, busy, save, reload } = useConfigValue(
  engineSettingOwner(props.setting),
  props.setting.key,
);

// a setting listed anew can come with other engines to pick from
watch(
  () => props.setting,
  () => void reload(),
);

const pick = async function (value: ConfigValueType) {
  if (await save(value)) emit("saved", props.setting);
};
</script>
