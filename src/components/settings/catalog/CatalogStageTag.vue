<template>
  <Badge
    v-if="label"
    variant="outline"
    class="h-5 gap-1.5 rounded-md px-1.5 text-[11px]"
    data-testid="catalog-stage-tag"
    :data-stage="stage"
  >
    <span
      class="size-1.5 shrink-0 rounded-full"
      :class="dotClass"
      aria-hidden="true"
    ></span>
    {{ label }}
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import {
  getProviderStageTranslationKey,
  shouldShowStageBadge,
} from "@/helpers/provider_config";
import { ProviderStage } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { match } from "ts-pattern";
import { computed } from "vue";

interface Props {
  // a stable or unknown stage shows no tag
  stage?: ProviderStage | string | null;
}

const props = defineProps<Props>();

const label = computed(() => {
  if (!shouldShowStageBadge(props.stage)) return "";
  const key = getProviderStageTranslationKey(props.stage);
  return key ? $t(key) : "";
});

// amber while it is still being built, red once it is on its way out
const dotClass = computed(() =>
  match(props.stage)
    .with(ProviderStage.ALPHA, ProviderStage.EXPERIMENTAL, () => "bg-amber-500")
    .with(ProviderStage.BETA, () => "bg-primary")
    .with(ProviderStage.UNMAINTAINED, () => "bg-orange-600")
    .with(ProviderStage.DEPRECATED, () => "bg-destructive")
    .otherwise(() => undefined),
);
</script>
