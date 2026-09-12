<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { isMacPlatform } from "@/composables/useCommandCenter";
import { eventbus } from "@/plugins/eventbus";
import { useHotkey } from "@tanstack/vue-hotkeys";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const open = ref(false);
const modifierKey = isMacPlatform ? "⌘" : "Ctrl";
const shiftKey = isMacPlatform ? "⇧" : "Shift";

interface Shortcut {
  label: string;
  keys: string[][];
}

const shortcutSections = computed(() => [
  {
    label: t("keyboard_shortcuts_sections.player"),
    shortcuts: [
      {
        label: t("shortcut_play_pause"),
        keys: [["Space"]],
      },
      { label: t("shortcut_seek_back"), keys: [[modifierKey, "←"]] },
      { label: t("shortcut_seek_forward"), keys: [[modifierKey, "→"]] },
      {
        label: t("shortcut_volume_up"),
        keys: [[modifierKey, shiftKey, "↑"]],
      },
      {
        label: t("shortcut_volume_down"),
        keys: [[modifierKey, shiftKey, "↓"]],
      },
      { label: t("shortcut_mute"), keys: [[modifierKey, "M"]] },
      {
        label: t("open_fullscreen_player"),
        keys: [[modifierKey, shiftKey, "F"]],
      },
      { label: t("players"), keys: [[modifierKey, "P"]] },
      { label: t("lyrics_show"), keys: [[modifierKey, shiftKey, "L"]] },
      { label: t("shortcut_mute"), keys: [[modifierKey, shiftKey, "M"]] },
      {
        label: t("previous_track"),
        keys: [[modifierKey, shiftKey, "←"]],
      },
      { label: t("next_track"), keys: [[modifierKey, shiftKey, "→"]] },
    ] satisfies Shortcut[],
  },
  {
    label: t("keyboard_shortcuts_sections.general"),
    shortcuts: [
      { label: t("command_center.title"), keys: [[modifierKey, "K"]] },
      { label: t("sidebar.title"), keys: [[modifierKey, "B"]] },
      { label: t("keyboard_shortcuts"), keys: [[modifierKey, "/"]] },
    ] satisfies Shortcut[],
  },
]);

const openDialog = () => {
  open.value = true;
};

useHotkey("Mod+/", openDialog, { ignoreInputs: true });

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
            <span class="flex shrink-0 items-center gap-2">
              <span
                v-for="(keys, index) in shortcut.keys"
                :key="keys.join('-')"
                class="flex items-center gap-1"
              >
                <span v-if="index > 0" class="text-muted-foreground">/</span>
                <Kbd v-for="key in keys" :key="key" class="font-mono">
                  {{ key }}
                </Kbd>
              </span>
            </span>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
