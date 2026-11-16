<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-4">
      <h2 class="m-0 text-lg font-semibold">
        {{ title }}
      </h2>
      <!-- touch screens swipe the row; a mouse needs a way to move it -->
      <div class="flex gap-1 max-md:hidden">
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="$t('settings.catalog.previous')"
          @click="scroll(-1)"
        >
          <ChevronLeft class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          :aria-label="$t('settings.catalog.next')"
          @click="scroll(1)"
        >
          <ChevronRight class="size-4" />
        </Button>
      </div>
    </div>
    <!-- the row clips what leaves it, so its padding holds the lift and the
         shadow of a hovered card, and its negative margins keep it in place -->
    <div
      ref="scroller"
      class="-mx-6 -mt-1 -mb-3 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pt-1 pb-5 max-md:-mx-3 max-md:scroll-px-3 max-md:px-3"
    >
      <div
        v-for="suggestion in suggestions"
        :key="suggestion.entry.manifest.domain"
        class="w-72 shrink-0 snap-start max-sm:w-[72%]"
      >
        <CatalogCard
          :entry="suggestion.entry"
          :installing="installing.has(suggestion.entry.manifest.domain)"
          :paired-with="suggestion.pairedWith"
          :dismissible="isPersonalSuggestion(suggestion)"
          @open="emit('open', suggestion.entry)"
          @add="emit('add', suggestion.entry)"
          @dismiss="emit('dismiss', suggestion.entry.manifest.domain)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import CatalogCard from "@/components/settings/catalog/CatalogCard.vue";
import { Button } from "@/components/ui/button";
import {
  type CatalogSuggestion,
  isPersonalSuggestion,
} from "@/helpers/catalog_recommendations";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { $t } from "@/plugins/i18n";
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import { useTemplateRef } from "vue";

interface Props {
  suggestions: CatalogSuggestion[];
  title: string;
  // the domains being installed from the community catalog
  installing: ReadonlySet<string>;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "open", entry: CatalogEntry): void;
  (e: "add", entry: CatalogEntry): void;
  (e: "dismiss", domain: string): void;
}>();

const scroller = useTemplateRef<HTMLElement>("scroller");

// a page of cards at a time, keeping one in view for context
const scroll = (direction: 1 | -1) => {
  const element = scroller.value;
  if (!element) return;
  element.scrollBy({
    left: direction * element.clientWidth * 0.8,
    behavior: "smooth",
  });
};
</script>
