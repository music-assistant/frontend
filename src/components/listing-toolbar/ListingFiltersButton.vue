<template>
  <Popover>
    <!-- one button for both layouts: the popover anchors to the element the
         trigger first rendered, so swapping it out would leave it unplaced -->
    <PopoverTrigger as-child>
      <Button
        :variant="compact ? 'ghost' : 'outline'"
        :size="compact ? 'icon-lg' : 'icon'"
        class="relative"
        :class="{ 'text-primary hover:text-primary': activeCount }"
        :title="buttonLabel"
        :aria-label="buttonLabel"
      >
        <!-- the icon alone, with the count on top of it: an outlined button
             beside the sort's on a wide screen, a bare icon on a phone -->
        <ListFilter :class="{ 'size-[22px]': compact }" />
        <Badge
          v-if="activeCount"
          class="absolute h-4 min-w-4 px-1 text-[10px]"
          :class="compact ? 'top-1 right-0.5' : '-top-1.5 -right-1.5'"
          aria-hidden="true"
        >
          {{ activeCount }}
        </Badge>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      :aria-label="$t('listing_filters.title')"
      class="max-h-(--reka-popover-content-available-height) w-[min(340px,calc(100vw-32px))] overflow-y-auto"
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

const buttonLabel = computed(() =>
  props.activeCount
    ? t("listing_filters.title_active", { count: props.activeCount })
    : t("listing_filters.title"),
);
</script>
