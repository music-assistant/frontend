<template>
  <div class="flex items-center justify-between gap-2.5">
    <Badge
      variant="warning"
      class="h-7 min-w-0 shrink items-center gap-1 rounded-md py-0 leading-none"
    >
      <CircleAlert class="size-3" />
      <span class="truncate">
        {{ reason ?? $t("settings.player_needs_setup") }}
      </span>
    </Badge>
    <Button
      size="xs"
      variant="warning"
      class="shrink-0"
      @click.stop="emit('setup')"
    >
      {{ $t("settings.start_setup") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircleAlert } from "@lucide/vue";

defineProps<{
  // why the player needs setup, in words; a generic text when it gave none
  reason?: string;
}>();

const emit = defineEmits<{
  (e: "setup"): void;
}>();
</script>
