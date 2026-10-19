<template>
  <div
    :class="TRACK_TABLE_GRID_CLASS"
    class="mb-1 h-9 border-b border-border text-[13px] text-muted-foreground"
    :style="{ gridTemplateColumns: gridTemplate }"
  >
    <template v-for="column in columns" :key="column">
      <span v-if="column === 'number'" :title="$t('track_table.track_number')">
        <span aria-hidden="true">#</span>
        <span class="sr-only">{{ $t("track_table.track_number") }}</span>
      </span>
      <span v-else-if="column === 'title'" class="truncate">
        {{ $t("track_table.title") }}
      </span>
      <span v-else-if="column === 'album'" class="truncate">
        {{ $t("album") }}
      </span>
      <span v-else-if="column === 'year'" class="truncate">
        {{ $t("track_table.year") }}
      </span>
      <span
        v-else-if="column === 'bpm'"
        class="truncate"
        :title="$t('tooltip.bpm')"
      >
        {{ $t("bpm") }}
      </span>
      <span
        v-else-if="column === 'key'"
        class="truncate"
        :title="$t('tooltip.musical_key')"
      >
        {{ $t("musical_key") }}
      </span>
      <span
        v-else-if="column === 'duration'"
        class="flex justify-end"
        :title="$t('track_table.duration')"
      >
        <Clock3 class="size-4" aria-hidden="true" />
        <span class="sr-only">{{ $t("track_table.duration") }}</span>
      </span>
      <span v-else-if="column === 'menu'" class="flex justify-center">
        <!-- not modal, so the page still scrolls when the table sits low on screen -->
        <DropdownMenu :modal="false">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="$t('track_table.choose_columns')"
              :title="$t('track_table.choose_columns')"
            >
              <Columns3 class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="min-w-56">
            <DropdownMenuLabel>{{
              $t("track_table.columns")
            }}</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              v-for="option in options"
              :key="option.column"
              :model-value="enabled.includes(option.column)"
              @select="(event: Event) => event.preventDefault()"
              @update:model-value="toggle(option.column)"
            >
              <span class="flex flex-col">
                {{ option.label }}
                <span
                  v-if="hiddenAtWidth(option.column)"
                  class="text-xs text-muted-foreground"
                >
                  {{ $t("track_table.hidden_at_width") }}
                </span>
              </span>
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
      <span v-else></span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { $t } from "@/plugins/i18n";
import { Clock3, Columns3 } from "@lucide/vue";
import { computed } from "vue";
import {
  OPTIONAL_TRACK_COLUMNS,
  TRACK_TABLE_GRID_CLASS,
  trackTableGridTemplate,
  type OptionalTrackColumn,
  type TrackColumn,
} from "./trackTableColumns";

export interface Props {
  // the columns shown, in order
  columns: TrackColumn[];
  // the columns the user switched on, shown or not
  enabled: OptionalTrackColumn[];
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "update:enabled": [columns: OptionalTrackColumn[]];
}>();

const gridTemplate = computed(() => trackTableGridTemplate(props.columns));

const OPTION_LABEL_KEYS: Record<OptionalTrackColumn, string> = {
  album: "album",
  number: "track_table.track_number",
  year: "track_table.year",
  bpm: "bpm",
  key: "musical_key",
};

const options = computed(() =>
  OPTIONAL_TRACK_COLUMNS.map((column) => ({
    column,
    label: $t(OPTION_LABEL_KEYS[column]),
  })),
);

// switched on, but the table is too narrow for it
const hiddenAtWidth = (column: OptionalTrackColumn) =>
  props.enabled.includes(column) && !props.columns.includes(column);

const toggle = function (column: OptionalTrackColumn) {
  const next = props.enabled.includes(column)
    ? props.enabled.filter((c) => c !== column)
    : [...props.enabled, column];
  emit("update:enabled", next);
};
</script>
