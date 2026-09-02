<script setup lang="ts">
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { eventbus } from "@/plugins/eventbus";
import { Keyboard } from "@lucide/vue";
</script>

<template>
  <DropdownMenuItem @click="eventbus.emit('keyboardShortcutsDialog')">
    <Keyboard class="size-[18px]" />
    {{ $t("keyboard_shortcuts") }}
  </DropdownMenuItem>
</template>
