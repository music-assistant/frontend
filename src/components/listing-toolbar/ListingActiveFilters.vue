<template>
  <ul
    :aria-label="$t('listing_filters.active')"
    class="flex list-none items-center gap-2 overflow-x-auto px-4 pt-1 pb-3 [scrollbar-width:none]"
  >
    <li
      v-for="chip in chips"
      :key="chip.key"
      class="flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card ps-3 pe-1 text-[13px]"
    >
      <!-- a phone keeps the chips short: the value names the filter well enough -->
      <component
        :is="chip.icon"
        v-if="chip.icon && !compact"
        class="size-3.5"
      />
      <span v-if="chip.group && !compact" class="text-muted-foreground">
        {{ chip.group }}:
      </span>
      {{ chip.label }}
      <Button
        variant="ghost"
        size="icon-xs"
        class="rounded-full text-muted-foreground"
        :title="removeLabel(chip)"
        :aria-label="removeLabel(chip)"
        @click="chip.remove()"
      >
        <X class="size-3.5" />
      </Button>
    </li>
    <li v-if="!compact" class="flex shrink-0">
      <Button
        variant="link"
        size="sm"
        class="h-8 px-2.5"
        @click="emit('clear')"
      >
        {{ $t("listing_filters.clear_all") }}
      </Button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type { ActiveFilterChip } from "@/helpers/listing_filters";
import { X } from "@lucide/vue";
import { useI18n } from "vue-i18n";

defineProps<{
  chips: ActiveFilterChip[];
  compact: boolean;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const { t } = useI18n();

const removeLabel = (chip: ActiveFilterChip) =>
  t("listing_filters.remove", [
    chip.group ? `${chip.group} ${chip.label}` : chip.label,
  ]);
</script>
