<template>
  <RouterLink
    v-if="variant === 'card'"
    :to="section.route"
    class="group rounded-(--radius-xl) text-inherit no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
  >
    <Card
      class="h-full gap-1 rounded-(--radius-xl) px-6 pt-5 pb-6 transition duration-200 group-hover:-translate-y-1 group-hover:border-primary/30 group-hover:shadow-lg max-md:px-4 max-md:pt-4 max-md:pb-5"
    >
      <div class="mb-2.5 flex items-center justify-between">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-(--radius-lg) text-white shadow-sm transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[5deg]"
          :style="iconStyle"
        >
          <component :is="section.icon" class="size-5" aria-hidden="true" />
        </span>
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground transition duration-200 group-hover:translate-x-1 group-hover:bg-primary/10 group-hover:text-primary max-md:size-7"
        >
          <ChevronRight class="size-5" aria-hidden="true" />
        </span>
      </div>
      <h3 class="m-0 text-base leading-snug font-semibold max-md:text-[15px]">
        {{ t(section.label) }}
      </h3>
      <p class="m-0 text-sm leading-normal text-muted-foreground">
        {{ t(section.description) }}
      </p>
    </Card>
  </RouterLink>

  <Item
    v-else
    as-child
    class="group min-h-20 rounded-(--radius-xl) border-0 px-6 py-5 hover:bg-accent/50 max-md:min-h-18 max-md:p-4"
  >
    <RouterLink :to="section.route" class="text-inherit no-underline">
      <ItemMedia>
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-(--radius-lg) text-white shadow-sm"
          :style="iconStyle"
        >
          <component :is="section.icon" class="size-5" aria-hidden="true" />
        </span>
      </ItemMedia>
      <ItemContent class="gap-1">
        <ItemTitle class="text-base leading-snug font-semibold">
          {{ t(section.label) }}
        </ItemTitle>
        <ItemDescription class="max-md:text-[13px]">
          {{ t(section.description) }}
        </ItemDescription>
      </ItemContent>
      <ChevronRight
        class="size-5 text-muted-foreground opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100"
        aria-hidden="true"
      />
    </RouterLink>
  </Item>
</template>

<script setup lang="ts">
import { Card } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { SettingsSection } from "@/helpers/settings_sections";
import { ChevronRight } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";

interface Props {
  section: SettingsSection;
  variant: "card" | "list";
}

const props = defineProps<Props>();

const { t } = useI18n();

const SECTION_COLORS: Record<string, string> = {
  indigo: "rgb(99, 102, 241)",
  blue: "rgb(59, 130, 246)",
  green: "rgb(34, 197, 94)",
  purple: "rgb(168, 85, 247)",
  "deep-purple": "rgb(124, 58, 237)",
  orange: "rgb(249, 115, 22)",
  teal: "rgb(20, 184, 166)",
  "grey-darken-1": "rgb(158, 158, 158)",
};

const iconStyle = computed(() => ({
  backgroundColor: SECTION_COLORS[props.section.color] || SECTION_COLORS.indigo,
}));
</script>
