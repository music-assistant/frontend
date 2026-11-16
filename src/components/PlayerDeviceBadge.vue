<template>
  <Badge
    as="span"
    variant="outline"
    class="player-device-badge border-foreground/25 text-muted-foreground h-5 shrink-0 gap-1 px-1.5 text-[11px] shadow-none"
    :aria-hidden="label ? undefined : 'true'"
  >
    <component :is="deviceIcon" aria-hidden="true" class="size-3" />
    <span v-if="label" class="player-device-badge-label">
      {{ $t("this_device") }}
    </span>
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { DEVICE_TYPE_ICONS } from "@/helpers/icon";
import { store } from "@/plugins/store";
import { computed } from "vue";

defineProps<{
  /** Also show the "This device" label next to the form-factor icon. */
  label?: boolean;
}>();

const deviceIcon = computed(() => DEVICE_TYPE_ICONS[store.deviceType]);
</script>
