<template>
  <TooltipProvider v-if="variant === 'icon'" :delay-duration="200">
    <Tooltip>
      <TooltipTrigger as-child>
        <span
          role="img"
          tabindex="0"
          class="text-muted-foreground inline-flex"
          :aria-label="label"
          data-testid="community-marker"
        >
          <Users class="size-3.5" aria-hidden="true" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{{ label }}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
  <div
    v-else
    class="text-muted-foreground flex items-center gap-1.5 text-xs"
    data-testid="community-marker"
  >
    <Users class="size-3.5 shrink-0" aria-hidden="true" />
    <span class="min-w-0">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { $t } from "@/plugins/i18n";
import { Users } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  // icon: a muted icon next to a name, with the text in a tooltip;
  // line: the icon followed by who maintains the provider
  variant: "icon" | "line";
  // the maintainers' handles, named on the line
  maintainers?: string[];
}

const props = defineProps<Props>();

const label = computed(() =>
  props.variant === "line" && props.maintainers?.length
    ? $t("settings.provider_community_maintained_by", {
        maintainers: props.maintainers.join(", "),
      })
    : $t("settings.provider_community_maintained"),
);
</script>
