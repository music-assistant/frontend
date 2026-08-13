<!--
  Global dialog to speak a message on a player: type the text (or speak it into
  the microphone, where one is available), choose whether the chime plays first
  and send it. Opened from the player card menu and the fullscreen player
  overflow menu via the centralized eventbus.
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
        <!-- only offered where the microphone can actually be used -->
        <Tabs
          v-if="micAvailable"
          :model-value="mode"
          @update:model-value="(value) => (mode = value as AnnouncementMode)"
        >
          <TabsList class="grid w-full grid-cols-2">
            <TabsTrigger value="type" :disabled="busy">
              {{ $t("play_announcement_mode_type") }}
            </TabsTrigger>
            <TabsTrigger value="speak" :disabled="busy">
              {{ $t("play_announcement_mode_speak") }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div v-if="mode === 'type'" class="flex flex-col gap-2">
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

        <div v-else class="flex flex-col items-center gap-3 py-2">
          <Button
            type="button"
            :variant="liveState === 'recording' ? 'destructive' : 'default'"
            :class="[
              'size-20 touch-none rounded-full select-none',
              liveState === 'recording' ? 'animate-pulse' : '',
            ]"
            :aria-label="$t('play_announcement_hold_to_speak')"
            @pointerdown="onSpeakPointerDown"
            @pointerup="stopSpeaking"
            @pointercancel="stopSpeaking"
            @keydown.space.prevent="onSpeakKeyDown"
            @keydown.enter.prevent="onSpeakKeyDown"
            @keyup.space="stopSpeaking"
            @keyup.enter="stopSpeaking"
            @blur="onSpeakBlur"
            @contextmenu.prevent
          >
            <Mic class="size-8" />
          </Button>
          <p class="text-sm text-muted-foreground" aria-live="polite">
            {{ speakStatus }}
            <span v-if="liveState === 'recording'" class="tabular-nums">
              {{ formatDuration(elapsedSeconds) }}
            </span>
          </p>
        </div>

        <div class="flex items-center justify-between gap-4">
          <Label for="announcement-pre-announce" class="cursor-pointer">
            {{ $t("play_announcement_pre_announce") }}
          </Label>
          <Switch
            id="announcement-pre-announce"
            v-model="preAnnounce"
            :disabled="busy"
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
          v-if="mode === 'type'"
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
import { Mic } from "@lucide/vue";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  liveAnnouncementSupported,
  useLiveAnnouncement,
} from "@/composables/useLiveAnnouncement";
import { formatDuration } from "@/helpers/utils";
import api from "@/plugins/api";
import { type PlayAnnouncementDialogEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";

type AnnouncementMode = "type" | "speak";

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
const mode = ref<AnnouncementMode>("type");

const playerName = computed(() => api.players[playerId.value]?.name ?? "");
const micAvailable = computed(() => liveAnnouncementSupported());

const {
  state: liveState,
  elapsedSeconds,
  start: startLive,
  stop: stopLive,
  cancel: cancelLive,
} = useLiveAnnouncement({
  onFinished: () => {
    toast.success($t("play_announcement_sent", [playerName.value]));
    showDialog.value = false;
  },
  onError: (errorMessage: string) => toast.error(errorMessage),
});

const busy = computed(() => sending.value || liveState.value !== "idle");

const speakStatus = computed(() => {
  switch (liveState.value) {
    case "connecting":
      return $t("play_announcement_connecting");
    case "recording":
      return $t("play_announcement_speaking");
    case "finishing":
      return $t("play_announcement_finishing");
    default:
      return $t("play_announcement_hold_to_speak");
  }
});

watch(showDialog, (open) => {
  store.dialogActive = open;
  // closing mid-clip ends it and hands the microphone back
  if (!open) cancelLive();
});

// a connection change can withdraw the microphone while the dialog is open, which
// would otherwise leave the speak panel up with no tabs and no way to send
watch(micAvailable, (available) => {
  if (available) return;
  cancelLive();
  mode.value = "type";
});

onMounted(() => {
  eventbus.on("playAnnouncementDialog", (evt: PlayAnnouncementDialogEvent) => {
    playerId.value = evt.playerId;
    message.value = "";
    preAnnounce.value = true;
    mode.value = "type";
    dialogKey.value++;
    showDialog.value = true;
    void seedPreAnnounce(evt.playerId);
  });
});

onBeforeUnmount(() => {
  eventbus.off("playAnnouncementDialog");
  cancelLive();
});

function onSpeakPointerDown(event: PointerEvent): void {
  // a right or middle click must not open the microphone
  if (event.button !== 0) return;
  // keep receiving the release even when the finger slides off the button
  (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  startSpeaking();
}

function onSpeakKeyDown(event: KeyboardEvent): void {
  if (event.repeat) return;
  startSpeaking();
}

function startSpeaking(): void {
  if (!playerId.value) return;
  void startLive(playerId.value, preAnnounce.value);
}

function stopSpeaking(): void {
  stopLive();
}

function onSpeakBlur(): void {
  // the permission prompt takes focus off the button on the first press, so
  // only a clip that is already recording is ended by losing focus
  if (liveState.value !== "recording") return;
  stopLive();
}

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
