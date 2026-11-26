<template>
  <Card
    class="relative h-full gap-0 overflow-hidden rounded-(--radius-lg) p-0"
    :class="{ 'card-hover': to || openable }"
  >
    <CatalogArt
      :color="tone === 'muted' ? null : color"
      :error="tone === 'error'"
      class="h-10 shrink-0"
    >
      <slot name="banner" />
    </CatalogArt>
    <!-- an action on the banner, above the name that covers the card -->
    <div v-if="$slots.corner" class="absolute top-1 right-1.5 z-10">
      <slot name="corner" />
    </div>
    <div class="flex flex-1 flex-col px-4 pb-4">
      <div class="flex items-start gap-3">
        <CatalogIconTile
          :src="iconSrc"
          :size="44"
          :on-dark="onDark"
          class="relative -mt-[22px]"
        />
        <div class="min-w-0 flex-1 pt-1.5">
          <!-- the badges go under a name they would cut short -->
          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3
              class="m-0 max-w-full min-w-0 truncate text-base leading-[22px] font-semibold"
            >
              <slot name="name">
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
                <!-- the heading would hide a button that does not fit whole, so
                     the button cuts its own text short -->
                <button
                  v-else-if="openable"
                  type="button"
                  :class="STRETCHED_CLASS"
                  class="block max-w-full cursor-pointer truncate text-left"
                  data-testid="catalog-card-open"
                  @click="emit('open')"
                >
                  {{ name }}
                </button>
                <template v-else>{{ name }}</template>
              </slot>
            </h3>
            <slot name="badges" />
          </div>
          <p
            v-if="$slots.subtitle"
            class="m-0 mt-0.5 truncate text-xs text-muted-foreground"
            data-testid="catalog-card-subtitle"
          >
            <slot name="subtitle" />
          </p>
        </div>
      </div>
      <slot />
      <div
        v-if="$slots.footer"
        class="mt-auto flex items-center justify-between gap-3 pt-3"
      >
        <slot name="footer" />
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
  // a banner in the colours of the theme, or a pale red one for an error, in
  // place of the colour of the icon
  tone?: "muted" | "error";
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "open"): void;
}>();

defineSlots<{
  // on the banner, beside the icon
  banner?(): unknown;
  // an action on the corner of the banner
  corner?(): unknown;
  // in place of the name, for a card that opens it in its own way
  name?(): unknown;
  // beside the name
  badges?(): unknown;
  // under the name
  subtitle?(): unknown;
  default?(): unknown;
  // the status on the left of the bottom of the card, its actions on the right
  footer?(): unknown;
}>();

const STRETCHED_CLASS =
  "outline-none after:absolute after:inset-0 after:rounded-(--radius-lg) focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 focus-visible:after:ring-inset";

const { iconSrc, onDark, color } = useCatalogArt(
  () => props.domain,
  () => props.icon,
);
</script>
