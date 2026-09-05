<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { eventbus } from "@/plugins/eventbus";
import { useHotkey } from "@tanstack/vue-hotkeys";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const open = ref(false);

interface Shortcut {
  label: string;
  keys: string[];
}

const shortcutSections = computed(() => [
  {
    label: t("keyboard_shortcuts_sections.player"),
    shortcuts: [
      { label: t("shortcut_play_pause"), keys: ["Space", "K"] },
      { label: t("shortcut_seek_back"), keys: ["←"] },
      { label: t("shortcut_seek_forward"), keys: ["→"] },
      { label: t("shortcut_volume_up"), keys: ["↑"] },
      { label: t("shortcut_volume_down"), keys: ["↓"] },
      { label: t("shortcut_mute"), keys: ["M"] },
      {
        label: t("open_fullscreen_player"),
        keys: ["Ctrl/Cmd", "Shift", "F"],
      },
      { label: t("players"), keys: ["Ctrl/Cmd", "P"] },
      { label: t("lyrics_show"), keys: ["Ctrl/Cmd", "Shift", "L"] },
      { label: t("shortcut_mute"), keys: ["Ctrl/Cmd", "Shift", "M"] },
      {
        label: t("previous_track"),
        keys: ["Ctrl/Cmd", "Shift", "←"],
      },
      { label: t("next_track"), keys: ["Ctrl/Cmd", "Shift", "→"] },
    ] satisfies Shortcut[],
  },
  {
    label: t("keyboard_shortcuts_sections.general"),
    shortcuts: [
      { label: t("command_center.title"), keys: ["Ctrl/Cmd", "K"] },
      { label: t("sidebar.title"), keys: ["Ctrl/Cmd", "B"] },
      { label: t("keyboard_shortcuts"), keys: ["Ctrl/Cmd", "Shift", "P"] },
    ] satisfies Shortcut[],
  },
]);

const openDialog = () => {
  open.value = true;
};

useHotkey("Mod+Shift+P", openDialog, { ignoreInputs: true });

onMounted(() => eventbus.on("keyboardShortcutsDialog", openDialog));
onUnmounted(() => eventbus.off("keyboardShortcutsDialog", openDialog));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ t("keyboard_shortcuts") }}</DialogTitle>
        <DialogDescription>
          {{ t("keyboard_shortcuts_description") }}
        </DialogDescription>
      </DialogHeader>
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <section
          v-for="section in shortcutSections"
          :key="section.label"
          class="space-y-2"
        >
          <div class="flex items-center gap-2">
            <h3 class="text-muted-foreground text-xs font-semibold uppercase">
              {{ section.label }}
            </h3>
            <div class="bg-border h-px flex-1" aria-hidden="true"></div>
          </div>
          <div
            v-for="shortcut in section.shortcuts"
            :key="shortcut.label"
            class="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
          >
            <span class="text-sm">{{ shortcut.label }}</span>
            <span class="flex shrink-0 items-center gap-1">
              <kbd
                v-for="key in shortcut.keys"
                :key="key"
                class="bg-muted text-muted-foreground rounded border px-1.5 py-0.5 font-mono text-xs"
              >
                {{ key }}
              </kbd>
            </span>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
