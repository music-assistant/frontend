<!--
  Inline shuffle switch for the play menu.

  Rendered as a non-selectable row so flipping the switch sets the intent for the
  play option the user picks next, without closing the menu.
-->
<template>
  <div class="shuffle-toggle-row" @pointerdown.stop @click.stop>
    <Shuffle :size="20" class="shuffle-toggle-row__icon" />
    <span class="shuffle-toggle-row__label">{{ $t("shuffle") }}</span>
    <Switch
      :model-value="modelValue"
      :aria-label="$t('shuffle')"
      class="shrink-0"
      @update:model-value="emit('update:modelValue', $event === true)"
    />
  </div>
</template>

<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import { $t } from "@/plugins/i18n";
import { Shuffle } from "@lucide/vue";

defineProps<{ modelValue: boolean }>();

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<style scoped>
.shuffle-toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 8px;
  font-size: 0.875rem;
}

.shuffle-toggle-row__icon {
  flex: 0 0 auto;
}

.shuffle-toggle-row__label {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
