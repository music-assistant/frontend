<template>
  <TooltipIcon
    v-if="variant === 'icon'"
    :label="$t('settings.provider_community_maintained')"
    data-testid="community-marker"
  >
    <Puzzle class="size-3.5" aria-hidden="true" />
  </TooltipIcon>
  <div
    v-else
    class="text-muted-foreground flex items-center gap-1.5 text-xs"
    data-testid="community-marker"
  >
    <Badge variant="secondary">{{ $t("settings.provider_community") }}</Badge>
    <span v-if="maintainedBy" class="min-w-0">{{ maintainedBy }}</span>
  </div>
</template>

<script setup lang="ts">
import TooltipIcon from "@/components/TooltipIcon.vue";
import { Badge } from "@/components/ui/badge";
import { $t } from "@/plugins/i18n";
import { Puzzle } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  // icon: a muted icon next to a name, with a tooltip;
  // line: a Community badge followed by who maintains the provider
  variant: "icon" | "line";
  // the maintainers' handles, named on the line
  maintainers?: string[];
}

const props = defineProps<Props>();

const maintainedBy = computed(() =>
  props.maintainers?.length
    ? $t("settings.provider_maintained_by", {
        maintainers: props.maintainers.join(", "),
      })
    : "",
);
</script>
