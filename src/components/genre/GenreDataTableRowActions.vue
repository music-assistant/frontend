<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" class="size-8 p-0">
        <span class="sr-only">{{ $t("open") }}</span>
        <MoreVertical class="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem @click="emit('navigate')">
        {{ $t("details") }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        :disabled="pending"
        @click="emit('exclude')"
      >
        {{ $t("exclude_genre") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { MoreVertical } from "lucide-vue-next";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

defineProps<{ pending: boolean }>();
const emit = defineEmits<{ navigate: []; exclude: [] }>();
</script>
