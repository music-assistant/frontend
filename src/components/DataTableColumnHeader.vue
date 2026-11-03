<script lang="ts">
export default {
  inheritAttrs: false,
};
</script>

<script setup lang="ts">
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "@lucide/vue";
import type { Column, RowData } from "@tanstack/vue-table";

import type { DataTableFeatures } from "@/components/dataTableFeatures";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// only the sorting and visibility methods, so a column of any row type fits
type SortableColumn = Pick<
  Column<DataTableFeatures, RowData, unknown>,
  | "getCanSort"
  | "getIsSorted"
  | "toggleSorting"
  | "getCanHide"
  | "toggleVisibility"
>;

defineProps<{
  column: SortableColumn;
  title: string;
  align?: "left" | "center" | "right";
}>();
</script>

<template>
  <div
    v-if="column.getCanSort()"
    :class="
      cn(
        'flex items-center',
        align === 'right' ? 'justify-end' : '',
        align === 'center' ? 'justify-center' : '',
        $attrs.class ?? '',
      )
    "
  >
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          :class="
            cn(
              'h-8 data-[state=open]:bg-accent',
              align === 'center' ? '' : align === 'right' ? '-mr-3' : '-ml-3',
            )
          "
        >
          <span>{{ title }}</span>
          <ArrowDown
            v-if="column.getIsSorted() === 'desc'"
            class="ml-2 size-4"
          />
          <ArrowUp
            v-else-if="column.getIsSorted() === 'asc'"
            class="ml-2 size-4"
          />
          <ChevronsUpDown v-else class="ml-2 size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem @click="column.toggleSorting(false)">
          <ArrowUp class="mr-2 size-3.5 text-muted-foreground/70" />
          {{ $t("sort.ascending_abbreviation") }}
        </DropdownMenuItem>
        <DropdownMenuItem @click="column.toggleSorting(true)">
          <ArrowDown class="mr-2 size-3.5 text-muted-foreground/70" />
          {{ $t("sort.descending_abbreviation") }}
        </DropdownMenuItem>
        <template v-if="column.getCanHide()">
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="column.toggleVisibility(false)">
            <EyeOff class="mr-2 size-3.5 text-muted-foreground/70" />
            {{ $t("data_table.hide") }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  <div v-else :class="$attrs.class as string">
    {{ title }}
  </div>
</template>
