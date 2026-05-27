<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-1">
      <Label>{{ label }}</Label>
      <Tooltip>
        <TooltipTrigger as-child>
          <span class="cursor-help inline-flex">
            <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-[220px] z-[10001]">
          {{ tooltip }}
        </TooltipContent>
      </Tooltip>
    </div>
    <TagsInput
      :model-value="selectedItem ? [selectedItem.item_id] : []"
      @update:model-value="emit('clear')"
    >
      <TagsInputItem
        v-if="selectedItem"
        :value="selectedItem.item_id"
        class="bg-primary text-primary-foreground"
      >
        <span class="py-0.5 px-2 text-sm truncate max-w-[180px] block">{{
          selectedItem.name
        }}</span>
        <TagsInputItemDelete />
      </TagsInputItem>
      <Popover v-if="!selectedItem">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :disabled="disabled"
            class="h-7 gap-1 border-dashed text-xs"
          >
            <PlusCircle class="h-3 w-3" />
            {{ pickLabel }}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-[260px] p-2">
          <Input
            :model-value="searchQuery"
            :placeholder="$t('search')"
            class="mb-2 h-7 text-sm"
            @update:model-value="emit('update:searchQuery', $event as string)"
            @keydown.stop
          />
          <div class="max-h-48 overflow-y-auto flex flex-col">
            <div v-if="isSearching" class="flex justify-center py-2">
              <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
            <div
              v-for="item in results"
              :key="item.item_id"
              class="flex flex-col py-0.5 px-1 cursor-pointer text-sm hover:bg-accent rounded-sm"
              @click.stop="emit('select', item)"
            >
              <span class="truncate font-medium">{{ item.name }}</span>
              <slot name="item-sub" :item="item"></slot>
            </div>
            <p
              v-if="searchQuery.length < 2"
              class="text-xs text-muted-foreground py-1 px-1"
            >
              {{ $t("search") }}...
            </p>
            <p
              v-else-if="results.length === 0"
              class="text-xs text-muted-foreground py-1 px-1"
            >
              {{ $t("no_results") }}
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </TagsInput>
    <slot name="after-tags"></slot>
  </div>
</template>

<script setup lang="ts">
import { HelpCircle, Loader2, PlusCircle } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TagsInput,
  TagsInputItem,
  TagsInputItemDelete,
} from "@/components/ui/tags-input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SearchItem {
  item_id: string;
  name: string;
}

const props = defineProps<{
  label: string;
  tooltip: string;
  pickLabel: string;
  disabled: boolean;
  selectedItem: SearchItem | null;
  searchQuery: string;
  results: SearchItem[];
  isSearching: boolean;
}>();

const emit = defineEmits<{
  "update:searchQuery": [value: string];
  select: [item: SearchItem];
  clear: [];
}>();
</script>
