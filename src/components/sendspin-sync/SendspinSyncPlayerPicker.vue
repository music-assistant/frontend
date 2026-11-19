<template>
  <Card class="gap-4">
    <CardHeader>
      <CardTitle>{{ $t(`${KEYS}.pick.title`) }}</CardTitle>
      <CardDescription class="space-y-2">
        <p>{{ $t(`${KEYS}.pick.description`) }}</p>
        <!-- Said before anything is touched: the house goes quiet, and whoever
             else is listening deserves to hear that from the person doing it. -->
        <p>{{ $t(`${KEYS}.pick.what_happens`) }}</p>
      </CardDescription>
    </CardHeader>

    <CardContent class="space-y-4">
      <Empty v-if="!players.length">
        <EmptyHeader>
          <EmptyTitle>{{ $t(`${KEYS}.pick.none.title`) }}</EmptyTitle>
          <EmptyDescription>
            {{ $t(`${KEYS}.pick.none.description`) }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <FieldSet v-else>
        <FieldLegend variant="label" class="sr-only">
          {{ $t(`${KEYS}.pick.legend`) }}
        </FieldLegend>
        <div class="space-y-1">
          <!-- The for/id pair is what names the checkbox: it reads the text of
               the label pointing at it, so a busy speaker is announced with its
               badge. An aria-label here would replace that, not add to it. -->
          <label
            v-for="player in players"
            :key="player.player_id"
            :for="`sendspin-sync-${player.player_id}`"
            class="flex min-h-11 items-center gap-2 rounded-md px-2 transition-colors"
            :class="{
              'bg-primary/10': selected.includes(player.player_id),
              'hover:bg-accent/50 cursor-pointer': !disabled && !player.silent,
              'cursor-not-allowed': disabled || player.silent,
            }"
          >
            <span class="min-w-0 flex-1 truncate text-sm">
              {{ player.name }}
            </span>
            <!-- What the speaker is before what it happens to be doing, so the
                 row does not reorder as playback starts and stops. -->
            <Badge
              v-if="!player.adjustable"
              variant="secondary"
              class="shrink-0"
            >
              {{ $t(`${KEYS}.manual.badge`) }}
            </Badge>
            <Badge v-if="player.busy" variant="warning" class="shrink-0">
              {{ $t(`${KEYS}.pick.busy`) }}
            </Badge>
            <!-- The server refuses a speaker nobody could hear, so it is said
                 here, where turning it up is one step away, and not after the
                 start has failed. -->
            <Badge v-if="player.silent" variant="destructive" class="shrink-0">
              {{ $t(`${KEYS}.pick.silent`) }}
            </Badge>
            <Checkbox
              :id="`sendspin-sync-${player.player_id}`"
              :model-value="selected.includes(player.player_id)"
              :disabled="disabled || player.silent"
              class="border-muted-foreground/70 bg-background/70 size-5 border-2 shadow-sm"
              @update:model-value="toggle(player.player_id, $event)"
            />
          </label>
        </div>
      </FieldSet>

      <!-- Taking a speaker off the user's own music is worth saying out loud
           before it happens, not after. -->
      <Alert v-if="busySelected.length" variant="warning">
        <TriangleAlert class="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{{ $t(`${KEYS}.pick.takeover.title`) }}</AlertTitle>
        <AlertDescription>
          {{
            $t(`${KEYS}.pick.takeover.description`, [
              busySelected.map((player) => player.name).join(", "),
            ])
          }}
        </AlertDescription>
      </Alert>

      <div
        v-if="players.length"
        class="space-y-1 text-sm text-muted-foreground"
      >
        <p>{{ $t(`${KEYS}.pick.minimum`) }}</p>
        <p v-if="anySilent">{{ $t(`${KEYS}.pick.silent_hint`) }}</p>
        <!-- The badge on its own only names the case; this says why it is still
             worth ticking those speakers rather than skipping them. -->
        <p v-if="anyManual">{{ $t(`${KEYS}.pick.manual`) }}</p>
        <!-- How much of the result will have to be entered by hand, before the
             walk rather than after it. -->
        <p v-if="manualSelected.length" class="text-foreground">
          {{
            manualSelected.length === selected.length
              ? $t(`${KEYS}.pick.all_manual`)
              : $t(`${KEYS}.pick.some_manual`, [
                  selected.length - manualSelected.length,
                  selected.length,
                ])
          }}
        </p>
        <p>{{ $t(`${KEYS}.pick.checklist`) }}</p>
        <p v-if="!blocked">{{ $t(`${KEYS}.pick.microphone`) }}</p>
      </div>
    </CardContent>

    <CardFooter>
      <Button
        class="w-full sm:w-auto"
        :disabled="disabled || blocked || starting || selected.length < 2"
        @click="emit('start', busySelected.length > 0)"
      >
        <Spinner
          v-if="disabled || starting"
          class="size-4"
          aria-hidden="true"
        />
        <Play v-else class="size-4" aria-hidden="true" />
        {{
          busySelected.length
            ? $t(`${KEYS}.pick.start_takeover`)
            : $t(`${KEYS}.pick.start`)
        }}
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type { CalibrationPlayer } from "@/plugins/api/interfaces";
import { Play, TriangleAlert } from "@lucide/vue";
import { computed } from "vue";

const KEYS = "providers.sendspin_sync.calibration";

const {
  players,
  selected,
  disabled,
  blocked = false,
  starting = false,
} = defineProps<{
  players: CalibrationPlayer[];
  selected: string[];
  disabled: boolean;
  /** True when this browser cannot open a microphone at all, so nothing can start. */
  blocked?: boolean;
  /** True while a start is under way, the microphone prompt included. */
  starting?: boolean;
}>();

const emit = defineEmits<{
  "update:selected": [playerIds: string[]];
  /** The boolean says whether starting means taking a busy speaker over. */
  start: [force: boolean];
}>();

const busySelected = computed(() =>
  players.filter(
    (player) => player.busy && selected.includes(player.player_id),
  ),
);

const anyManual = computed(() => players.some((player) => !player.adjustable));
const anySilent = computed(() => players.some((player) => player.silent));

/** The picked speakers whose result will come back as an amount to enter by hand. */
const manualSelected = computed(() =>
  players.filter(
    (player) => !player.adjustable && selected.includes(player.player_id),
  ),
);

/**
 * Add or remove one speaker, keeping the order the user picked them in.
 *
 * Ticking appends rather than re-sorting, so the walk lists the speakers in a
 * stable order the user chose. Which one is walked first is decided there, not
 * here.
 */
function toggle(playerId: string, checked: boolean | "indeterminate"): void {
  emit(
    "update:selected",
    checked === true
      ? [...selected, playerId]
      : selected.filter((id) => id !== playerId),
  );
}
</script>
