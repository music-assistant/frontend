<template>
  <div class="flex items-center justify-between border-t px-6 py-3">
    <span class="text-sm text-muted-foreground">{{ info }}</span>
    <div class="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        class="size-8"
        :disabled="page <= 1"
        @click="emit('prev')"
      >
        <ChevronLeft class="size-4" />
      </Button>
      <span class="min-w-[4rem] text-center text-sm text-muted-foreground">
        {{ page }} / {{ totalPages }}
      </span>
      <Button
        variant="outline"
        size="icon"
        class="size-8"
        :disabled="!hasNextPage"
        @click="emit('next')"
      >
        <ChevronRight class="size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronLeft, ChevronRight } from "lucide-vue-next";

import { Button } from "@/components/ui/button";

interface Props {
  info: string;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
}

defineProps<Props>();
const emit = defineEmits<{ prev: []; next: [] }>();
</script>
