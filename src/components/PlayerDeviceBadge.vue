<template>
  <Badge
    as="span"
    variant="secondary"
    class="h-5 shrink-0 gap-1 px-1.5 text-[11px]"
  >
    <Smartphone
      v-if="store.deviceType === 'phone'"
      aria-hidden="true"
      class="size-3"
    />
    <Monitor v-else aria-hidden="true" class="size-3" />
    <span
      class="player-device-badge-label"
      :class="{ 'sr-only': store.deviceType === 'phone' }"
    >
      {{ $t("this_device") }}
    </span>
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { store } from "@/plugins/store";
import { Monitor, Smartphone } from "@lucide/vue";
</script>
