<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>{{ $t("providers.ai_radio.create.title") }}</DialogTitle>
        <DialogDescription>
          {{ $t("providers.ai_radio.create.description") }}
        </DialogDescription>
      </DialogHeader>

      <div
        class="flex max-h-[60vh] flex-col gap-5 overflow-x-hidden overflow-y-auto -mx-6 px-6 py-1"
      >
        <div class="flex flex-col gap-2">
          <Label>{{ $t("providers.ai_radio.create.playlist_label") }}</Label>
          <AiRadioPlaylistPicker v-model="selectedPlaylist" />
        </div>

        <div class="flex flex-col gap-2">
          <Label for="ai-radio-create-host">
            {{ $t("providers.ai_radio.fields.host") }}
          </Label>
          <Select v-model="selectedHostId">
            <SelectTrigger id="ai-radio-create-host" class="w-full">
              <SelectValue
                :placeholder="
                  $t('providers.ai_radio.customize.host_placeholder')
                "
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="host in hosts" :key="host.id" :value="host.id">
                {{ host.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="hosts.length === 0" class="text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.customize.no_hosts_hint") }}
            <button
              type="button"
              class="underline underline-offset-2 hover:text-foreground"
              @click="emit('open-hosts')"
            >
              {{ $t("providers.ai_radio.customize.create_host_cta") }}
            </button>
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="ai-radio-show-name">
            {{ $t("providers.ai_radio.create.name_label") }}
          </Label>
          <Input
            id="ai-radio-show-name"
            v-model="showName"
            @input="nameManuallyEdited = true"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t("cancel") }}
        </Button>
        <Button variant="outline" :disabled="isBusy" @click="doCreate(false)">
          {{
            creating
              ? $t("providers.ai_radio.create.creating")
              : $t("providers.ai_radio.create.create")
          }}
        </Button>
        <Button :disabled="isBusy" @click="doCreate(true)">
          {{
            creatingAndPlaying
              ? $t("providers.ai_radio.create.creating")
              : $t("providers.ai_radio.create.create_and_play")
          }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import AiRadioPlaylistPicker, {
  type PlaylistSelection,
} from "@/components/ai-radio/AiRadioPlaylistPicker.vue";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  compileShow,
  errorMessage,
  resolveShowPlayerId,
  type ShowDraft,
} from "@/helpers/ai_radio";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{
  open: boolean;
  initialPlaylist?: PlaylistSelection;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "open-hosts": [];
}>();

const { saveShow, startShow, reportStartError } = useShows();
const { hosts, loadHosts } = useHosts();

const selectedPlaylist = ref<PlaylistSelection | undefined>();
const selectedHostId = ref("");
const showName = ref("");
const nameManuallyEdited = ref(false);
const creating = ref(false);
const creatingAndPlaying = ref(false);

const isBusy = computed(() => creating.value || creatingAndPlaying.value);

function defaultShowName(): string {
  const hostName = hosts.value.find(
    (host) => host.id === selectedHostId.value,
  )?.name;
  if (!hostName) return $t("providers.ai_radio.gallery.new_show");
  if (!selectedPlaylist.value) return hostName;
  return $t("providers.ai_radio.create.default_name", [
    hostName,
    selectedPlaylist.value.name,
  ]);
}

function resetForm(initialPlaylist?: PlaylistSelection) {
  selectedPlaylist.value = initialPlaylist;
  selectedHostId.value = hosts.value[0]?.id || "";
  nameManuallyEdited.value = false;
  showName.value = defaultShowName();
}

watch(
  () => props.open,
  async (isOpen) => {
    store.dialogActive = isOpen;
    if (!isOpen) return;
    // Always refresh: a cached list still renders instantly, but host names
    // edited elsewhere would otherwise show up stale in the picker.
    try {
      await loadHosts();
    } catch (error) {
      toast.error(errorMessage(error));
    }
    resetForm(props.initialPlaylist);
  },
);

watch([selectedHostId, selectedPlaylist], () => {
  if (!nameManuallyEdited.value) {
    showName.value = defaultShowName();
  }
});

function buildDraft(): ShowDraft {
  return {
    basics: {
      name: showName.value.trim(),
      sourcePlaylistId: selectedPlaylist.value?.itemId || "",
      sourcePlaylistProvider: selectedPlaylist.value?.provider || "library",
      defaultPlayerId: "",
      maxDurationMinutes: 0,
      shuffleSourceTracks: true,
    },
    hostId: selectedHostId.value,
  };
}

function validate(): string | null {
  if (!selectedPlaylist.value) {
    return $t("providers.ai_radio.create.validation.playlist_required");
  }
  if (!selectedHostId.value) {
    return $t("providers.ai_radio.create.validation.host_required");
  }
  if (!showName.value.trim()) {
    return $t("providers.ai_radio.create.validation.name_required");
  }
  return null;
}

async function doCreate(andPlay: boolean) {
  if (isBusy.value) return;
  const validationError = validate();
  if (validationError) {
    toast.error(validationError);
    return;
  }
  const busyRef = andPlay ? creatingAndPlaying : creating;
  busyRef.value = true;
  try {
    const station = compileShow(buildDraft());
    const saved = await saveShow(station);
    emit("update:open", false);
    if (andPlay) {
      await playAfterCreate(saved.id, saved.default_player_id);
    }
  } catch (error) {
    toast.error(errorMessage(error));
  } finally {
    busyRef.value = false;
  }
}

async function playAfterCreate(stationId: string, defaultPlayerId?: string) {
  const playerId = resolveShowPlayerId(
    { default_player_id: defaultPlayerId },
    store.activePlayerId,
  );
  if (!playerId) {
    toast.error($t("providers.ai_radio.card.no_player"));
    return;
  }
  try {
    await startShow(stationId, playerId);
  } catch (error) {
    const message = errorMessage(error);
    toast.error($t("providers.ai_radio.card.start_failed", [message]));
    reportStartError(message);
  }
}
</script>
