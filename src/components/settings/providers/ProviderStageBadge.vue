<template>
  <Badge v-if="label" :variant="variant" class="uppercase">
    {{ label }}
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import {
  getProviderStageTranslationKey,
  shouldShowStageBadge,
} from "@/helpers/provider_config";
import type { ProviderStage } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { match } from "ts-pattern";
import { computed } from "vue";

interface Props {
  // a stable or unknown stage shows no badge
  stage?: ProviderStage | string | null;
}

const props = defineProps<Props>();

const label = computed(() => {
  if (!shouldShowStageBadge(props.stage)) return "";
  const key = getProviderStageTranslationKey(props.stage);
  return key ? $t(key) : "";
});

const variant = computed(() =>
  match(props.stage)
    .with("beta", () => "secondary" as const)
    .with("alpha", () => "outline" as const)
    .with("experimental", () => "outline" as const)
    .with("unmaintained", () => "secondary" as const)
    .with("deprecated", () => "destructive" as const)
    .otherwise(() => "default" as const),
);
</script>
