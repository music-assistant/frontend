<template>
  <!-- clickable: a badge-shaped trigger that opens the row's source picker -->
  <DropdownMenu v-if="interactive">
    <DropdownMenuTrigger as-child>
      <Badge
        as="button"
        type="button"
        variant="secondary"
        class="cursor-pointer gap-1.5 bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        :aria-label="`${$t('row_source')}: ${label}`"
      >
        <ProviderIcon v-if="domain" :domain="domain" :size="12" />
        {{ label }}
      </Badge>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <DropdownMenuRadioGroup
        :model-value="selected"
        @update:model-value="onSelect"
      >
        <DropdownMenuRadioItem
          v-for="option in options"
          :key="option.value"
          :value="option.value"
        >
          <ProviderIcon
            v-if="option.domain"
            :domain="option.domain"
            :size="16"
          />
          {{ option.label }}
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- plain: bg-secondary paints Vuetify's own teal, so the pill takes the muted
       surface instead (same treatment as the rows editor's hidden badge) -->
  <Badge
    v-else
    as="span"
    variant="secondary"
    class="gap-1.5 bg-muted text-muted-foreground"
  >
    <ProviderIcon v-if="domain" :domain="domain" :size="12" />
    {{ label }}
  </Badge>
</template>

<script setup lang="ts">
import type { RowSource, SourceOption } from "@/components/details/rowRegistry";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

export interface Props {
  // e.g. "In your library" or "On Spotify"
  label: string;
  // provider domain for the leading icon, when a single provider feeds the row
  domain?: string;
  // the sources the row can switch to; the badge becomes a picker when more than
  // one is offered, and stays a plain label otherwise
  options?: SourceOption[];
  // the source currently feeding the row, highlighted in the picker
  selected?: RowSource;
}
const props = withDefaults(defineProps<Props>(), {
  domain: undefined,
  options: undefined,
  selected: undefined,
});

const emit = defineEmits<{
  (e: "select", source: RowSource): void;
}>();

const interactive = computed(() => (props.options?.length ?? 0) > 1);

function onSelect(source: unknown) {
  if (typeof source === "string") emit("select", source);
}
</script>
