<template>
  <Card
    class="relative h-full gap-0 overflow-hidden rounded-(--radius-xl) p-0"
    :class="{ 'card-hover': to || openable }"
  >
    <CatalogArt :color="color" class="h-20 shrink-0" />
    <!-- an action on the banner, above the name that covers the card -->
    <div v-if="$slots.corner" class="absolute top-2 right-2 z-10">
      <slot name="corner"></slot>
    </div>
    <div class="flex flex-1 flex-col px-4 pb-4">
      <CatalogIconTile
        :src="iconSrc"
        :size="52"
        :on-dark="onDark"
        class="relative -mt-7 mb-3"
      />
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 class="m-0 text-base leading-snug font-semibold">
          <!-- the name stretches over the card, so the whole card opens it
               while the actions on it stay their own controls -->
          <RouterLink
            v-if="to"
            :to="to"
            :class="STRETCHED_CLASS"
            class="text-inherit no-underline"
            data-testid="catalog-card-open"
          >
            {{ name }}
          </RouterLink>
          <button
            v-else-if="openable"
            type="button"
            :class="STRETCHED_CLASS"
            class="cursor-pointer text-left"
            data-testid="catalog-card-open"
            @click="emit('open')"
          >
            {{ name }}
          </button>
          <template v-else>{{ name }}</template>
        </h3>
        <slot name="badges"></slot>
      </div>
      <slot></slot>
      <div
        v-if="$slots.footer"
        class="mt-auto flex items-center justify-between gap-3 pt-3"
      >
        <slot name="footer"></slot>
      </div>
    </div>
  </Card>
</template>

<script setup lang="ts">
import CatalogArt from "@/components/settings/catalog/CatalogArt.vue";
import CatalogIconTile from "@/components/settings/catalog/CatalogIconTile.vue";
import { Card } from "@/components/ui/card";
import { useCatalogArt } from "@/composables/settings/catalog/useCatalogArt";
import { RouterLink, type RouteLocationRaw } from "vue-router";

interface Props {
  domain: string;
  name: string;
  // the icon the community catalog gives, which the server does not serve itself
  icon?: string | null;
  // where the card leads, for a card that opens a page
  to?: RouteLocationRaw;
  // whether the card emits open, for a card that opens its details
  openable?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "open"): void;
}>();

const STRETCHED_CLASS =
  "outline-none after:absolute after:inset-0 after:rounded-(--radius-xl) focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 focus-visible:after:ring-inset";

const { iconSrc, onDark, color } = useCatalogArt(
  () => props.domain,
  () => props.icon,
);
</script>
