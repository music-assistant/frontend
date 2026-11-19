<template>
  <section class="space-y-3" data-testid="catalog-browse">
    <h2 class="m-0 text-lg font-semibold">
      {{ $t("settings.catalog.browse_everything") }}
    </h2>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <button
        v-for="{ type, count } in types"
        :key="type.type"
        type="button"
        class="flex items-center justify-between gap-2 rounded-(--radius-xl) border bg-card p-4 text-left card-hover outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        data-testid="catalog-browse-type"
        :data-type="type.type"
        @click="emit('select', type.type)"
      >
        <span class="min-w-0">
          <span class="block text-sm font-semibold">{{ $t(type.label) }}</span>
          <span class="block text-xs text-muted-foreground">
            {{ $t("settings.catalog.to_choose_from", { count }) }}
          </span>
        </span>
        <ChevronRight
          class="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CatalogTypeCount } from "@/helpers/provider_catalog";
import type { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ChevronRight } from "@lucide/vue";

interface Props {
  types: CatalogTypeCount[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "select", type: ProviderType): void;
}>();
</script>
