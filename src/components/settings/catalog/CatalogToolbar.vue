<template>
  <div
    class="flex flex-wrap items-center gap-3 md:items-start"
    data-testid="catalog-toolbar"
  >
    <CatalogTypePicker
      :tab="tab"
      :types="types"
      :installed-count="installedCount"
      :update-count="updateCount"
      @select="emit('select', $event)"
    />
    <!-- the pills take the room between the picker and the stage filter -->
    <div v-if="labels.length" class="flex min-w-0 flex-1 items-center gap-3">
      <Separator
        orientation="vertical"
        class="self-start data-[orientation=vertical]:mt-1.5 data-[orientation=vertical]:h-6 max-md:hidden"
      />
      <ProviderLabelFilter v-model="label" :labels="labels" class="min-w-0" />
    </div>
    <div v-if="filterable" class="ml-auto">
      <FacetedFilter
        v-model="stages"
        :title="$t('settings.stage.label')"
        :options="stageOptions"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FacetedFilter from "@/components/FacetedFilter.vue";
import CatalogTypePicker from "@/components/settings/catalog/CatalogTypePicker.vue";
import ProviderLabelFilter from "@/components/settings/providers/ProviderLabelFilter.vue";
import { Separator } from "@/components/ui/separator";
import {
  ADDABLE_PROVIDER_STAGES,
  type CatalogTab,
  type CatalogTypeCount,
} from "@/helpers/provider_catalog";
import { getProviderStageTranslationKey } from "@/helpers/provider_config";
import type { ProviderLabel } from "@/helpers/provider_labels";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

interface Props {
  // the section shown
  tab: CatalogTab;
  // the types with what each lists, in the order they are offered
  types: CatalogTypeCount[];
  // how many are set up
  installedCount: number;
  // the updates waiting in the community catalog
  updateCount: number;
  // what the list can be filtered on; none for no such filter
  labels: readonly ProviderLabel[];
  // whether a list is shown, which can be filtered on its stage
  filterable: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "select", tab: CatalogTab): void;
}>();

// the stages picked, kept by the page for the number of each type
const stages = defineModel<string[]>("stages", { required: true });
// the label picked, kept by the page for the same reason
const label = defineModel<ProviderLabel | null>("label", { required: true });

const stageOptions = computed(() =>
  ADDABLE_PROVIDER_STAGES.map((stage) => ({
    label: $t(getProviderStageTranslationKey(stage)!),
    value: stage,
  })),
);
</script>
