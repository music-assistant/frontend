<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>{{ $t("player_select.rename_player") }}</DialogTitle>
        <DialogDescription>
          {{ $t("player_select.rename_player_description") }}
        </DialogDescription>
      </DialogHeader>
      <form id="rename-player-form" class="py-2" @submit.prevent="save">
        <label for="rename-player-name" class="mb-2 block text-sm font-medium">
          {{ $t("settings.player_name") }}
        </label>
        <Input
          id="rename-player-name"
          v-model="name"
          :disabled="saving"
          :placeholder="defaultName ?? undefined"
          autocomplete="off"
          autofocus
        />
      </form>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          :disabled="saving"
          @click="close"
        >
          {{ $t("cancel") }}
        </Button>
        <Button type="submit" form="rename-player-form" :disabled="saving">
          {{ $t("settings.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { renamePlayer } from "@/helpers/player_settings_actions";
import { api } from "@/plugins/api";
import { eventbus, type PlayerRenameDialogEvent } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const open = ref(false);
const saving = ref(false);
const name = ref("");
const playerId = ref("");
const defaultName = ref<string | null>();

watch(open, (value) => {
  store.dialogActive = value;
});

const onRenameRequested = (evt: PlayerRenameDialogEvent) => {
  playerId.value = evt.playerId;
  name.value = evt.name ?? "";
  defaultName.value = evt.defaultName;
  saving.value = false;
  open.value = true;
};

onMounted(() => {
  eventbus.on("playerRenameDialog", onRenameRequested);
});

onBeforeUnmount(() => {
  // named so this drops only its own listener, not every listener for the event
  eventbus.off("playerRenameDialog", onRenameRequested);
  if (open.value) store.dialogActive = false;
});

async function save() {
  if (saving.value) return;
  // clearing the name hands the player back to the name its provider reports
  const nextName = name.value.trim() || null;

  saving.value = true;
  try {
    // a save that did not land keeps the dialog open to try again or cancel
    if (await renamePlayer(playerId.value, nextName)) {
      const player = api.players[playerId.value];
      if (player) player.name = nextName ?? defaultName.value ?? player.name;
      close();
    }
  } finally {
    saving.value = false;
  }
}

function setOpen(value: boolean) {
  if (!value && !saving.value) close();
}

function close() {
  open.value = false;
}
</script>
