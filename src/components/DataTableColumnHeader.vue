<script lang="ts">
export default {
  inheritAttrs: false,
};
</script>

<script setup lang="ts">
import type { Column } from "@tanstack/vue-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Column<any, unknown>;
  title: string;
  align?: "left" | "right";
}>();
</script>

<template>
  <div
    v-if="column.getCanSort()"
    :class="
      cn(
        'flex items-center',
        align === 'right' ? 'justify-end' : '',
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
              align === 'right' ? '-mr-3' : '-ml-3',
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
          Asc
        </DropdownMenuItem>
        <DropdownMenuItem @click="column.toggleSorting(true)">
          <ArrowDown class="mr-2 size-3.5 text-muted-foreground/70" />
          Desc
        </DropdownMenuItem>
        <template v-if="column.getCanHide()">
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="column.toggleVisibility(false)">
            <EyeOff class="mr-2 size-3.5 text-muted-foreground/70" />
            Hide
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  <div v-else :class="$attrs.class as string">
    {{ title }}
  </div>
</template>
