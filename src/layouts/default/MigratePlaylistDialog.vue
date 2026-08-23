<!--
  Global dialog to migrate a static library playlist to another provider.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <Dialog :key="dialogKey" v-model:open="showDialog">
    <DialogContent class="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle class="mb-2">{{
          $t("migrate_playlist.title")
        }}</DialogTitle>
        <DialogDescription>
          {{ $t("migrate_playlist.description", [playlist?.name]) }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <Label for="migrate-playlist-destination">
            {{ $t("migrate_playlist.destination_label") }}
          </Label>
          <Select v-model="destinationProviderId">
            <SelectTrigger id="migrate-playlist-destination" class="w-full">
              <SelectValue
                :placeholder="$t('migrate_playlist.destination_placeholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="provider in destinationProviders"
                :key="provider.instance_id"
                :value="provider.instance_id"
              >
                <provider-icon :domain="provider.domain" :size="20" />
                {{ provider.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="migrate-playlist-name">
            {{ $t("migrate_playlist.name_label") }}
          </Label>
          <Input id="migrate-playlist-name" v-model="destinationName" />
        </div>

        <div class="flex flex-col gap-2">
          <Label>{{ $t("migrate_playlist.match_policy_label") }}</Label>
          <RadioGroup v-model="matchPolicy" class="gap-2">
            <div
              v-for="option in matchPolicyOptions"
              :key="option.value"
              class="flex items-start gap-3 rounded-md border p-3"
            >
              <RadioGroupItem
                :id="`migrate-playlist-policy-${option.value}`"
                :value="option.value"
                class="mt-0.5"
              />
              <Label
                :for="`migrate-playlist-policy-${option.value}`"
                class="flex flex-1 flex-col items-start gap-1 font-normal"
              >
                <span class="text-sm font-medium">{{ option.title }}</span>
                <span
                  class="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap"
                >
                  {{ option.description }}
                </span>
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showDialog = false">
          {{ $t("close") }}
        </Button>
        <Button :disabled="!canSubmit" @click="doMigrate">
          {{ $t("migrate_playlist.submit") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/plugins/api";
import { getPlaylistMigrationProviders } from "@/plugins/api/helpers";
import {
  PlaylistMigrationMatchPolicy,
  type Playlist,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { type MigratePlaylistDialogEvent, eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { toast } from "vue-sonner";

const showDialog = ref(false);
// force Dialog remount via dynamic key to prevent the enter animation from
// stalling at opacity:0 when opened from a context menu
const dialogKey = ref(0);
const playlist = ref<Playlist>();
const destinationProviders = ref<ProviderInstance[]>([]);
const destinationProviderId = ref("");
const destinationName = ref("");
const matchPolicy = ref<PlaylistMigrationMatchPolicy>(
  PlaylistMigrationMatchPolicy.SAME_RECORDING,
);

const matchPolicyOptions = computed(() => [
  {
    value: PlaylistMigrationMatchPolicy.EXACT,
    title: $t("migrate_playlist.match_policy.exact.title"),
    description: $t("migrate_playlist.match_policy.exact.description"),
  },
  {
    value: PlaylistMigrationMatchPolicy.SAME_RECORDING,
    title: $t("migrate_playlist.match_policy.same_recording.title"),
    description: $t("migrate_playlist.match_policy.same_recording.description"),
  },
  {
    value: PlaylistMigrationMatchPolicy.BEST_EFFORT,
    title: $t("migrate_playlist.match_policy.best_effort.title"),
    description: $t("migrate_playlist.match_policy.best_effort.description"),
  },
]);

const canSubmit = computed(
  () => !!destinationProviderId.value && !!destinationName.value.trim(),
);

watch(showDialog, (open) => {
  store.dialogActive = open;
});

onMounted(() => {
  eventbus.on("migratePlaylistDialog", (evt: MigratePlaylistDialogEvent) => {
    playlist.value = evt.playlist;
    destinationProviders.value = getPlaylistMigrationProviders(evt.playlist);
    destinationProviderId.value = "";
    destinationName.value = evt.playlist.name;
    matchPolicy.value = PlaylistMigrationMatchPolicy.SAME_RECORDING;
    dialogKey.value++;
    showDialog.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("migratePlaylistDialog");
});

const doMigrate = async () => {
  if (!playlist.value || !canSubmit.value) return;
  showDialog.value = false;
  try {
    await api.migratePlaylist(
      playlist.value.item_id,
      destinationProviderId.value,
      matchPolicy.value,
      destinationName.value.trim(),
    );
  } catch (e) {
    toast.error(getErrorMessage(e));
  }
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return $t("error_generic");
};
</script>
