<template>
  <span
    class="mr-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.5px] text-primary-foreground"
    :style="{ background: props.badgeColor }"
  >
    <component :is="icon" :size="12" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { Rocket, UserRound } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  type: "request" | "boost";
  badgeColor?: string;
}

const props = defineProps<Props>();

const icon = computed(() => (props.type === "boost" ? Rocket : UserRound));

const label = computed(() =>
  props.type === "boost"
    ? $t("providers.party.boost")
    : $t("providers.party.request"),
);
</script>
