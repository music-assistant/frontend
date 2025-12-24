<template>
  <Popover v-model:open="open">
    <PopoverAnchor class="inline-flex w-full">
      <TagsInputRoot
        v-slot="{ modelValue: tags }"
        v-model="selectedValues"
        delimiter=""
        class="flex gap-2 items-center flex-wrap rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] min-h-[2.5rem] w-full"
      >
        <TagsInputItem
          v-for="item in tags"
          :key="String(item)"
          :value="item"
          class="flex items-center justify-center gap-1.5 text-sm bg-primary text-primary-foreground rounded px-2 py-0.5"
        >
          <span>{{ getLabelForValue(item) }}</span>
          <TagsInputItemDelete>
            <X :size="12" />
          </TagsInputItemDelete>
        </TagsInputItem>

        <TagsInputInput
          :placeholder="placeholder"
          class="flex-1 min-w-[120px]"
          @keydown.enter.prevent
          @keydown.down="open = true"
        />

        <PopoverTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
            class="ml-auto shrink-0"
            @click.prevent
          >
            <ChevronsUpDown :size="16" class="opacity-50" />
          </Button>
        </PopoverTrigger>
      </TagsInputRoot>
    </PopoverAnchor>

    <PopoverContent
      class="w-[var(--radix-popover-anchor-width)] p-0"
      align="start"
      :side-offset="4"
      :collision-padding="16"
      @open-auto-focus.prevent
    >
      <Command>
        <CommandInput :placeholder="$t('search')" />
        <CommandList class="max-h-[250px] overflow-y-auto">
          <CommandEmpty>{{ $t("no_content") }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="option in props.options"
              :key="option.value"
              :value="option.value"
              @select="
                (ev) => {
                  toggleOption(option.value);
                }
              "
            >
              {{ option.label }}
              <CheckIcon
                :class="
                  cn(
                    'ml-auto',
                    isSelected(option.value) ? 'opacity-100' : 'opacity-0',
                  )
                "
              />
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  TagsInputInput,
  TagsInputItem,
  TagsInputItemDelete,
} from "@/components/ui/tags-input";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronsUpDown, X } from "lucide-vue-next";
import { TagsInputRoot } from "reka-ui";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  modelValue?: string[];
  options: Array<{ label: string; value: string }>;
  placeholder?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const open = ref(false);

const selectedValues = computed({
  get: () => props.modelValue || [],
  set: (values: string[]) => {
    emit("update:modelValue", values);
  },
});

const isSelected = (value: string) => {
  return selectedValues.value.includes(value);
};

const toggleOption = (value: string) => {
  const current = selectedValues.value;
  const newValue = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value];
  selectedValues.value = newValue;
};

const getLabelForValue = (value: string) => {
  const option = props.options.find((opt) => opt.value === value);
  return option?.label || value;
};
</script>
