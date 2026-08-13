<!--
  Global dialog to speak a message on a player: type the text, choose whether
  the chime plays first and send it. Opened from the player card menu and the
  fullscreen player overflow menu via the centralized eventbus.
-->
<template>
  <Dialog :key="dialogKey" v-model:open="showDialog">
    <DialogContent class="sm:max-w-[460px]">
      <DialogHeader>
        <DialogTitle class="mb-1">{{ $t("play_announcement") }}</DialogTitle>
        <DialogDescription>
          {{ $t("play_announcement_explanation", [playerName]) }}
        </DialogDescription>
      </DialogHeader>

      <form
        id="play-announcement-form"
        class="flex flex-col gap-5 py-1"
        @submit.prevent="submit"
      >
        <div class="flex flex-col gap-2">
          <Label for="announcement-message">
            {{ $t("play_announcement_message") }}
          </Label>
          <Textarea
            id="announcement-message"
            v-model="message"
            :placeholder="$t('play_announcement_message_placeholder')"
            :disabled="sending"
            autofocus
          />
        </div>

        <div class="flex items-center justify-between gap-4">
          <Label for="announcement-pre-announce" class="cursor-pointer">
            {{ $t("play_announcement_pre_announce") }}
          </Label>
          <Switch
            id="announcement-pre-announce"
            v-model="preAnnounce"
            :disabled="sending"
          />
        </div>
      </form>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          :disabled="sending"
          @click="showDialog = false"
        >
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="play-announcement-form"
          :disabled="sending || !message.trim()"
        >
          {{ $t("play_announcement_send") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import api from "@/plugins/api";
import { type PlayAnnouncementDialogEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

const showDialog = ref(false);
// force Dialog remount via dynamic key to prevent the enter animation from
// stalling at opacity:0 when opened from a context menu
const dialogKey = ref(0);
const playerId = ref("");
const message = ref("");
// seeded from the player's own setting when the dialog opens; sent explicitly,
// so the toggle always shows what will actually be played
const preAnnounce = ref(true);
const sending = ref(false);

const playerName = computed(() => api.players[playerId.value]?.name ?? "");

watch(showDialog, (open) => {
  store.dialogActive = open;
});

onMounted(() => {
  eventbus.on("playAnnouncementDialog", (evt: PlayAnnouncementDialogEvent) => {
    playerId.value = evt.playerId;
    message.value = "";
    preAnnounce.value = true;
    dialogKey.value++;
    showDialog.value = true;
    void seedPreAnnounce(evt.playerId);
  });
});

onBeforeUnmount(() => {
  eventbus.off("playAnnouncementDialog");
});

async function seedPreAnnounce(player: string): Promise<void> {
  try {
    const configured = await api.getPlayerConfigValue(
      player,
      "tts_pre_announce",
    );
    // the dialog may already have been reopened for another player
    if (playerId.value === player && typeof configured === "boolean") {
      preAnnounce.value = configured;
    }
  } catch {
    // leave the toggle at the default the server would have applied anyway
  }
}

async function submit(): Promise<void> {
  const text = message.value.trim();
  if (!text || sending.value) return;

  sending.value = true;
  try {
    await api.playerCommandPlayAnnouncement(playerId.value, text, {
      preAnnounce: preAnnounce.value,
    });
    toast.success($t("play_announcement_sent", [playerName.value]));
    showDialog.value = false;
  } catch {
    // a failed command already surfaces the server's message globally; keep
    // the dialog open so the typed message isn't lost
  } finally {
    sending.value = false;
  }
}
</script>
