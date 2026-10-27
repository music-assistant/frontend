<template>
  <Popover>
    <!-- one button for both layouts: the popover anchors to the element the
         trigger first rendered, so swapping it out would leave it unplaced -->
    <PopoverTrigger as-child>
      <Button
        :variant="compact ? 'ghost' : 'outline'"
        :size="compact ? 'icon-lg' : 'default'"
        :class="triggerClass"
        :title="compact ? buttonLabel : undefined"
        :aria-label="buttonLabel"
      >
        <!-- a phone has room for the icon only, with the count on top of it -->
        <ListFilter :class="{ 'size-[22px]': compact }" />
        <template v-if="!compact">
          {{ $t("listing_filters.title") }}
        </template>
        <Badge
          v-if="activeCount"
          :class="
            compact
              ? 'absolute top-1 right-0.5 h-4 min-w-4 px-1 text-[10px]'
              : 'h-[18px] min-w-[18px] px-1.5'
          "
          aria-hidden="true"
        >
          {{ activeCount }}
        </Badge>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      class="w-[min(340px,calc(100vw-32px))]"
      @open-auto-focus="preventOnScreenKeyboardOnOpen"
    >
      <ListingFiltersPanel
        :filters="filters"
        :has-active-filters="activeCount > 0"
        @clear="emit('clear')"
      />
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import type { ListingFilter } from "@/helpers/listing_filters";
import { cn } from "@/lib/utils";
import { ListFilter } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ListingFiltersPanel from "./ListingFiltersPanel.vue";

const props = defineProps<{
  filters: ListingFilter[];
  activeCount: number;
  compact: boolean;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const { t } = useI18n();

const triggerClass = computed(() => {
  if (props.compact) {
    return cn(
      "relative",
      props.activeCount && "text-primary hover:text-primary",
    );
  }
  return cn(
    "h-10 gap-1.5",
    props.activeCount
      ? "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary dark:border-primary dark:bg-primary/10 dark:hover:bg-primary/15"
      : "border-dashed",
  );
});

const buttonLabel = computed(() =>
  props.activeCount
    ? t("listing_filters.title_active", { count: props.activeCount })
    : t("listing_filters.title"),
);
</script>
