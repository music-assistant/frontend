<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>
          {{ $t("settings.merge_player_title", [playerName]) }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("settings.merge_player_description") }}
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-4">
        <Popover v-model:open="popoverOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              role="combobox"
              :aria-expanded="popoverOpen"
              :disabled="merging"
              class="w-full justify-between"
              data-testid="merge-player-target"
            >
              {{ targetName || $t("settings.merge_player_pick") }}
              <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            class="w-(--reka-popover-trigger-width) p-0"
            @open-auto-focus="preventOnScreenKeyboardOnOpen"
          >
            <Command>
              <CommandInput :placeholder="$t('search')" />
              <CommandList class="max-h-[250px] overflow-y-auto">
                <CommandEmpty>{{ $t("no_content") }}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    v-for="target in targets"
                    :key="target.player_id"
                    :value="`${target.name} ${target.player_id}`"
                    @select="selectTarget(target.player_id)"
                  >
                    <span class="truncate">{{ target.name }}</span>
                    <span
                      class="ml-auto truncate text-xs text-muted-foreground"
                    >
                      {{ target.outputs }}
                    </span>
                    <Check
                      v-if="targetId === target.player_id"
                      class="size-4 shrink-0"
                    />
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <p v-if="targetName" class="text-sm text-muted-foreground">
          {{
            playerOutputs
              ? $t("settings.merge_player_confirmation_outputs", [
                  playerName,
                  targetName,
                  playerOutputs,
                ])
              : $t("settings.merge_player_confirmation", [
                  playerName,
                  targetName,
                ])
          }}
        </p>
      </div>
      <DialogFooter>
        <Button variant="outline" :disabled="merging" @click="close">
          {{ $t("cancel") }}
        </Button>
        <Button
          variant="destructive"
          :disabled="!targetId || merging"
          data-testid="merge-player-confirm"
          @click="merge"
        >
          {{ $t("settings.merge_player_confirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { preventOnScreenKeyboardOnOpen } from "@/helpers/dialog_focus";
import { getMergeTargets } from "@/helpers/player_merge";
import { getOutputName, mergePlayer } from "@/helpers/player_settings_actions";
import { getPlayerDisplayName } from "@/helpers/players";
import { api } from "@/plugins/api";
import type { PlayerProtocolInfo } from "@/plugins/api/interfaces";
import { eventbus, type PlayerMergeDialogEvent } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Check, ChevronsUpDown } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const OUTPUTS_SEPARATOR = " · ";

const open = ref(false);
const popoverOpen = ref(false);
const merging = ref(false);
const playerId = ref("");
const playerName = ref("");
const targetId = ref<string>();
let onMerged: PlayerMergeDialogEvent["onMerged"];

// each player with the outputs it has, to tell two players of the same name apart
const targets = computed(() =>
  getMergeTargets(playerId.value, Object.values(api.players))
    .map((player) => ({
      player_id: player.player_id,
      name: getPlayerDisplayName(player),
      outputs: getOutputNames(player.protocols),
    }))
    .sort((left, right) =>
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
    ),
);

// a player that is disabled has no outputs to name
const playerOutputs = computed(() =>
  getOutputNames(api.players[playerId.value]?.protocols ?? []),
);

const targetName = computed(
  () =>
    targets.value.find((target) => target.player_id === targetId.value)?.name,
);

watch(open, (value) => {
  store.dialogActive = value;
});

const onMergeRequested = (evt: PlayerMergeDialogEvent) => {
  playerId.value = evt.playerId;
  playerName.value = evt.playerName;
  onMerged = evt.onMerged;
  targetId.value = undefined;
  merging.value = false;
  popoverOpen.value = false;
  open.value = true;
};

onMounted(() => {
  eventbus.on("playerMergeDialog", onMergeRequested);
});

onBeforeUnmount(() => {
  // named so this drops only its own listener, not every listener for the event
  eventbus.off("playerMergeDialog", onMergeRequested);
  if (open.value) store.dialogActive = false;
});

function getOutputNames(protocols: PlayerProtocolInfo[]): string {
  return protocols.map(getOutputName).join(OUTPUTS_SEPARATOR);
}

function selectTarget(id: string) {
  targetId.value = id;
  popoverOpen.value = false;
}

async function merge() {
  const target = targetId.value;
  if (!target || merging.value) return;
  merging.value = true;
  try {
    // a merge the server refuses keeps the dialog open to pick another player
    if (await mergePlayer(playerId.value, target)) {
      close();
      onMerged?.(target);
    }
  } finally {
    merging.value = false;
  }
}

function setOpen(value: boolean) {
  if (!value && !merging.value) close();
}

function close() {
  open.value = false;
}
</script>
