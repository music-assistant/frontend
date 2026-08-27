<script setup lang="ts">
import { $t } from "@/plugins/i18n";
import { cn } from "@/lib/utils";
import { Loader2Icon } from "@lucide/vue";
import type { HTMLAttributes } from "vue";

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
  }>(),
  {
    class: undefined,
  },
);
</script>

<template>
  <Loader2Icon
    role="status"
    :aria-label="$t('loading_short')"
    :class="cn('size-4 animate-spin', props.class)"
  />
</template>
