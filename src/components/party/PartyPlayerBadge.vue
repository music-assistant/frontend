<template>
  <span class="party-badge">
    <Rocket v-if="props.type === 'boost'" class="size-3" />
    <UserRound v-else class="size-3" />
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { computed } from "vue";
import { Rocket, UserRound } from "lucide-vue-next";

interface Props {
  type: "request" | "boost";
  badgeColor?: string;
}

const props = defineProps<Props>();

const label = computed(() =>
  props.type === "boost"
    ? $t("providers.party.boost")
    : $t("providers.party.request"),
);
</script>

<style scoped>
.party-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: v-bind("props.badgeColor");
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.55rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: hsl(var(--primary-foreground));
  margin-right: 0.5rem;
}
</style>
