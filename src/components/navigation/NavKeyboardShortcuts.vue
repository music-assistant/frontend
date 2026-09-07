<script setup lang="ts">
import { isMacPlatform } from "@/composables/useCommandCenter";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { eventbus } from "@/plugins/eventbus";
import { Keyboard } from "@lucide/vue";

const keyboardShortcutsHotkeyLabel = isMacPlatform ? "⌘ ⇧ P" : "Ctrl Shift P";
</script>

<template>
  <DropdownMenuItem @click="eventbus.emit('keyboardShortcutsDialog')">
    <Keyboard class="size-[18px]" />
    {{ $t("keyboard_shortcuts") }}
    <Kbd class="ml-auto">{{ keyboardShortcutsHotkeyLabel }}</Kbd>
  </DropdownMenuItem>
</template>
