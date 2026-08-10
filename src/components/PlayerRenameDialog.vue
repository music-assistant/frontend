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
        <Button
          type="submit"
          form="rename-player-form"
          :disabled="saving || !name.trim()"
        >
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
import { api } from "@/plugins/api";
import type { Player } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  player?: Player;
}>();
const emit = defineEmits<{
  "update:open": [value: boolean];
}>();
const { t } = useI18n();
const name = ref("");
const saving = ref(false);

watch(
  () => props.open,
  (open) => {
    store.dialogActive = open;
    if (open) name.value = props.player?.name ?? "";
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (props.open) store.dialogActive = false;
});

async function save() {
  const player = props.player;
  const nextName = name.value.trim();
  if (!player || !nextName || saving.value) return;

  saving.value = true;
  try {
    await api.savePlayerConfig(player.player_id, { name: nextName });
    if (api.players[player.player_id]) {
      api.players[player.player_id].name = nextName;
    }
    toast.success(t("settings.player_saved"));
    close();
  } catch (error) {
    toast.error(String(error));
  } finally {
    saving.value = false;
  }
}

function setOpen(open: boolean) {
  if (!open && !saving.value) close();
}

function close() {
  emit("update:open", false);
}
</script>
