<template>
  <div class="flex flex-col gap-2">
    <Label>{{ label }}</Label>
    <TagsInput :model-value="modelIds" @update:model-value="onTagsChange">
      <TagsInputItem
        v-for="item in modelValue"
        :key="item.id"
        :value="String(item.id)"
        class="max-w-[240px] flex items-center justify-center gap-1.5 text-sm bg-primary text-primary-foreground rounded px-2 py-0.5"
      >
        <span class="block max-w-[200px] truncate whitespace-nowrap text-sm">{{
          item.name
        }}</span>
        <TagsInputItemDelete />
      </TagsInputItem>
      <Popover :open="disabled ? false : undefined">
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :disabled="disabled"
            class="h-7 gap-1 border-dashed text-xs"
          >
            <PlusCircle class="h-3 w-3" />
            {{ addLabel }}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" class="w-[200px] p-2">
          <Input
            v-model="localSearchQuery"
            :placeholder="$t('search')"
            class="mb-2 h-7 text-sm"
            @keydown.stop
          />
          <div class="max-h-36 overflow-y-auto flex flex-col">
            <div v-if="isSearching" class="flex justify-center py-2">
              <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
            <div
              v-for="result in results"
              :key="result.item_id"
              class="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
              @click.stop="
                emit('toggle', parseInt(result.item_id), result.name)
              "
            >
              <Checkbox
                :checked="selectedIdSet.has(parseInt(result.item_id))"
                class="h-4 w-4 pointer-events-none"
              />
              <span class="truncate">{{ result.name }}</span>
            </div>
            <p
              v-if="
                minSearchLength !== undefined &&
                localSearchQuery.length < minSearchLength
              "
              class="text-xs text-muted-foreground py-1"
            >
              {{ $t("search") }}...
            </p>
          </div>
        </PopoverContent>
      </Popover>
    </TagsInput>
    <p v-if="showSeedOverride" class="text-xs text-muted-foreground">
      {{ $t("smart_playlist.seed_overrides_filter") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Loader2, PlusCircle } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const props = defineProps<{
  label: string;
  addLabel: string;
  modelValue: { id: number; name: string }[];
  searchQuery: string;
  results: { item_id: string; name: string }[];
  isSearching?: boolean;
  disabled?: boolean;
  showSeedOverride?: boolean;
  minSearchLength?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: { id: number; name: string }[]];
  "update:searchQuery": [value: string];
  toggle: [id: number, name: string];
}>();

const localSearchQuery = computed({
  get: () => props.searchQuery,
  set: (v: string) => emit("update:searchQuery", v),
});

const modelIds = computed(() => props.modelValue.map((i) => String(i.id)));

const selectedIdSet = computed(
  () => new Set(props.modelValue.map((i) => i.id)),
);

function onTagsChange(newValues: string[]) {
  emit(
    "update:modelValue",
    props.modelValue.filter((item) => newValues.includes(String(item.id))),
  );
}
</script>
