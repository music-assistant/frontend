<template>
  <img
    v-if="iconSrc"
    :src="iconSrc"
    :width="size"
    :height="size"
    class="shrink-0"
    data-testid="cast-dashboard-device-icon"
  />
  <TvMinimal
    v-else
    :size="size"
    class="shrink-0"
    data-testid="cast-dashboard-device-icon"
  />
</template>

<script lang="ts">
// module-scoped so it survives across instances: reopening the dropdown re-mounts the
// items, and resolved provider icons rarely change, so cache by domain to avoid refetching.
const iconCache = new Map<string, string>();
</script>

<script setup lang="ts">
import api from "@/plugins/api";
import { TvMinimal } from "@lucide/vue";
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    providerDomainHint?: string | null;
    size?: number;
  }>(),
  {
    providerDomainHint: undefined,
    size: 14,
  },
);

const iconSrc = ref<string | null>(null);

watch(() => props.providerDomainHint, resolveIcon, { immediate: true });

async function resolveIcon(hint: string | null | undefined) {
  if (!hint) {
    iconSrc.value = null;
    return;
  }
  if (iconCache.has(hint)) {
    iconSrc.value = iconCache.get(hint)!;
    return;
  }
  try {
    const result = await api.sendCommand<string | null>("providers/icon", {
      provider: hint,
    });
    if (result) iconCache.set(hint, result);
    // Bail if the hint changed while the request was in flight.
    if (props.providerDomainHint === hint) iconSrc.value = result;
  } catch (error) {
    console.error("Failed to resolve provider icon:", error);
    if (props.providerDomainHint === hint) iconSrc.value = null;
  }
}
</script>
