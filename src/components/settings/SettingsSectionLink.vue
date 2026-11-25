<template>
  <RouterLink
    v-if="variant === 'featured'"
    :to="section.route"
    class="group rounded-(--radius-xl) text-inherit no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    data-testid="settings-section-featured"
  >
    <Card
      class="h-full flex-row items-center gap-4 rounded-(--radius-xl) card-hover px-5 py-5 max-md:gap-3 max-md:px-4 max-md:py-4"
    >
      <SettingsIcon
        :icon="section.icon"
        :color="section.color"
        class="size-12 max-md:size-10"
      />
      <div class="min-w-0 flex-1">
        <h3 class="m-0 text-base leading-snug font-semibold">
          {{ t(section.label) }}
        </h3>
        <p class="m-0 mt-0.5 text-sm leading-normal text-muted-foreground">
          {{ t(section.description) }}
        </p>
      </div>
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary max-md:size-7"
      >
        <ChevronRight class="size-5" aria-hidden="true" />
      </span>
    </Card>
  </RouterLink>

  <RouterLink
    v-else-if="variant === 'card'"
    :to="section.route"
    class="group rounded-(--radius-xl) text-inherit no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    data-testid="settings-section-card"
  >
    <Card class="h-full gap-2 rounded-(--radius-xl) card-hover px-4 pt-4 pb-5">
      <div class="flex items-center gap-3">
        <SettingsIcon
          :icon="section.icon"
          :color="section.color"
          class="size-9"
        />
        <h3 class="m-0 min-w-0 flex-1 text-base leading-snug font-semibold">
          {{ t(section.label) }}
        </h3>
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary max-md:size-7"
        >
          <ChevronRight class="size-5" aria-hidden="true" />
        </span>
      </div>
      <p class="m-0 text-sm leading-normal text-muted-foreground">
        {{ t(section.description) }}
      </p>
    </Card>
  </RouterLink>

  <Item
    v-else
    as-child
    class="group gap-5 rounded-(--radius-xl) border-0 px-4 py-3.5 hover:bg-accent/50 max-md:gap-4 max-md:px-3"
  >
    <RouterLink :to="section.route" class="text-inherit no-underline">
      <ItemMedia>
        <SettingsIcon :icon="section.icon" :color="section.color" />
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
        class="size-5 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </RouterLink>
  </Item>
</template>

<script setup lang="ts">
import SettingsIcon from "@/components/settings/SettingsIcon.vue";
import { Card } from "@/components/ui/card";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import type { SettingsMenuPage } from "@/helpers/settings_sections";
import { ChevronRight } from "@lucide/vue";
import { useI18n } from "vue-i18n";
import { RouterLink } from "vue-router";

interface Props {
  section: SettingsMenuPage;
  // a featured card puts the icon beside the description too, a card only
  // beside the title
  variant: "featured" | "card" | "list";
}

defineProps<Props>();

const { t } = useI18n();
</script>
