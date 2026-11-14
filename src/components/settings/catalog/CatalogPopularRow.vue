<template>
  <section class="space-y-3" data-testid="catalog-popular">
    <div class="flex items-center justify-between gap-4">
      <h2 class="m-0 text-lg font-semibold">
        {{ $t("settings.catalog.popular") }}
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
    <div
      ref="scroller"
      class="-mx-6 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-2 max-md:-mx-3 max-md:scroll-px-3 max-md:px-3"
    >
      <div
        v-for="entry in entries"
        :key="entry.manifest.domain"
        class="w-72 shrink-0 snap-start max-sm:w-[85%]"
      >
        <CatalogCard
          :entry="entry"
          @open="emit('open', entry)"
          @add="emit('add', entry)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import CatalogCard from "@/components/settings/catalog/CatalogCard.vue";
import { Button } from "@/components/ui/button";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { $t } from "@/plugins/i18n";
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import { useTemplateRef } from "vue";

interface Props {
  entries: CatalogEntry[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "open", entry: CatalogEntry): void;
  (e: "add", entry: CatalogEntry): void;
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
