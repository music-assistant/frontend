<template>
  <span class="party-badge">
    <v-icon size="x-small">{{ icon }}</v-icon>
    {{ label }}
  </span>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

interface Props {
  type: "request" | "boost";
  badgeColor?: string;
}

const props = defineProps<Props>();

const icon = computed(() =>
  props.type === "boost" ? "mdi-rocket-launch" : "mdi-account-music",
);

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
  color: rgb(var(--v-theme-on-primary));
  margin-right: 0.5rem;
}
</style>
