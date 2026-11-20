<template>
  <Card class="gap-4">
    <CardHeader>
      <CardTitle>{{ $t(`${KEYS}.results.${heading}.title`) }}</CardTitle>
      <CardDescription>
        {{ $t(`${KEYS}.results.${heading}.description`) }}
      </CardDescription>
    </CardHeader>

    <CardContent class="space-y-4">
      <!-- A run whose arrivals could not be placed on the chirp train has
           offsets, and they mean nothing. Showing them next to the reason they
           cannot be believed would only invite someone to copy them onto a
           speaker by hand. -->
      <ul v-if="usable" class="divide-y border-t">
        <li
          v-for="row in rows"
          :key="row.playerId"
          class="flex items-center justify-between gap-3 py-3"
        >
          <span class="flex min-w-0 items-center gap-2">
            <span class="min-w-0 truncate">{{ row.name }}</span>
            <Badge v-if="row.byHand" variant="secondary" class="shrink-0">
              {{ $t(`${KEYS}.manual.badge`) }}
            </Badge>
          </span>
          <span
            v-if="row.offset === null"
            class="shrink-0 text-sm text-destructive"
          >
            {{ $t(`${KEYS}.results.unheard`) }}
          </span>
          <span v-else class="flex shrink-0 flex-col items-end">
            <!-- The one number to act on leads. An amount to add to what the
                 device already applies and a delay that is set outright mean
                 opposite things, so each says which it is in words. -->
            <span class="font-medium">
              {{ $t(row.action.key, row.action.values) }}
            </span>
            <span
              v-if="row.detail"
              class="font-mono text-xs text-muted-foreground"
            >
              {{ $t(row.detail.key, row.detail.values) }}
            </span>
          </span>
        </li>
      </ul>

      <!-- Only once the server has said which speakers it could not write to, and
           what it worked out for them: before that the numbers above are raw
           readings, not delays anyone should be copying onto a device. -->
      <Alert v-if="manualNames.length" variant="info">
        <Wrench class="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{{ $t(`${KEYS}.manual.title`) }}</AlertTitle>
        <AlertDescription>
          {{ $t(`${KEYS}.manual.description`, [manualNames.join(", ")]) }}
        </AlertDescription>
      </Alert>

      <!-- What this run does and does not establish about itself, said in those
           terms: a number here that read as a pass either way would be worse than
           no number at all. -->
      <div
        class="rounded-md border p-3"
        :class="trustworthy ? '' : 'border-destructive'"
        role="status"
        aria-live="polite"
      >
        <!-- The answer to "can I apply this" in a word, ahead of the reasons. -->
        <p
          class="text-sm font-medium"
          :class="trustworthy ? '' : 'text-destructive'"
        >
          {{ $t(`${KEYS}.results.${trustworthy ? "ready" : "not_ready"}`) }}
        </p>
        <p class="font-medium">
          {{ $t(`${KEYS}.results.check.${verdict}.title`) }}
        </p>
        <p class="text-sm text-muted-foreground">
          {{
            $t(`${KEYS}.results.check.${verdict}.description`, verdictValues)
          }}
        </p>
      </div>

      <!-- What changes, and how to change it back, said once the change is made
           and while the numbers it replaced are still on the screen. -->
      <p v-if="wrote" class="text-sm text-muted-foreground">
        {{ $t(`${KEYS}.results.undo`) }}
      </p>

      <!-- For whoever is chasing a run that will not check out. Nobody deciding
           whether to press Apply needs a clock rate in parts per million. -->
      <details class="text-sm">
        <summary class="cursor-pointer text-muted-foreground">
          {{ $t(`${KEYS}.results.technical`) }}
        </summary>
        <dl
          class="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1"
        >
          <dt class="text-muted-foreground">
            {{ $t(`${KEYS}.results.clock`) }}
          </dt>
          <dd class="font-mono">
            {{ $t(`${KEYS}.results.ppm`, [fit.rateErrorPpm.toFixed(1)]) }}
          </dd>
          <!-- One figure for the run cannot separate a single bad speaker from
             detection that was poor everywhere, and those are different faults
             with different fixes. -->
          <dt class="text-muted-foreground">
            {{ $t(`${KEYS}.results.scatter`) }}
          </dt>
          <dd class="flex flex-col font-mono">
            <span v-for="row in scatterRows" :key="row.playerId">
              {{ $t(`${KEYS}.results.scatter_row`, [row.name, row.scatter]) }}
            </span>
          </dd>
          <dt class="text-muted-foreground">
            {{ $t(`${KEYS}.results.arrivals`) }}
          </dt>
          <dd class="font-mono">
            {{ $t(`${KEYS}.results.used`, [fit.used, fit.rejected]) }}
          </dd>
          <!-- Next to the chirps because the two are read together: arrivals
             thinner than expected are explained by a recording with holes in it,
             and there is nothing else on this panel that would say so. -->
          <dt class="text-muted-foreground">
            {{ $t(`${KEYS}.results.gaps`) }}
          </dt>
          <dd class="font-mono">
            {{ $t(`${KEYS}.results.lost`, [loss.dropouts, lostPercent]) }}
          </dd>
        </dl>
      </details>
    </CardContent>

    <CardFooter class="flex-col items-stretch gap-2 sm:flex-row">
      <!-- Absent rather than disabled on a run that did not check out: a control
           offering to apply delays the panel has just said cannot be trusted is
           a contradiction whichever state it is in. -->
      <Button
        v-if="trustworthy && !applyResult"
        :disabled="disabled"
        @click="emit('apply')"
      >
        <Spinner v-if="disabled" class="size-4" aria-hidden="true" />
        <Check v-else class="size-4" aria-hidden="true" />
        {{ $t(`${KEYS}.results.apply`) }}
      </Button>
      <!-- Once the delays are in, giving the speakers back is the next step and
           the one most easily forgotten. -->
      <Button
        :variant="applyResult ? 'default' : 'outline'"
        :disabled="disabled"
        @click="emit('finish')"
      >
        {{ $t(`${KEYS}.results.${applyResult ? "done" : "finish"}`) }}
      </Button>
      <Button
        v-if="wrote"
        variant="outline"
        :disabled="disabled"
        @click="emit('verify')"
      >
        {{ $t(`${KEYS}.results.verify_action`) }}
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
import { Spinner } from "@/components/ui/spinner";
import {
  MAX_OFFSET_SPAN_MS,
  MAX_PLAUSIBLE_RATE_PPM,
  type LatencyFit,
} from "@/helpers/sendspin-sync/latencyFit";
import {
  BRACKET_LIMIT_MS,
  MAX_LOST_FRACTION,
  offsetSpanMs,
  SCATTER_LIMIT_MS,
  worstSpreadMs,
  type CaptureLoss,
  type RunVerdict,
} from "@/helpers/sendspin-sync/verdict";
import type {
  CalibrationApplyResult,
  CalibrationPlayer,
} from "@/plugins/api/interfaces";
import { Check, Wrench } from "@lucide/vue";
import { computed } from "vue";

const KEYS = "providers.sendspin.calibration";

const {
  players,
  selected,
  fit,
  loss,
  verdict,
  applyResult,
  trustworthy,
  anchor,
  disabled,
  verifying = false,
} = defineProps<{
  players: CalibrationPlayer[];
  /** Every speaker the run set out to measure, in the order it walked them. */
  selected: string[];
  fit: LatencyFit;
  /** What the run's recordings lost, which the fit itself cannot show. */
  loss: CaptureLoss;
  verdict: RunVerdict;
  /** The delays the server worked out, split by whether it could write them. */
  applyResult: CalibrationApplyResult | null;
  trustworthy: boolean;
  anchor: string | null;
  disabled: boolean;
  /** True when these readings were taken over delays this run already applied. */
  verifying?: boolean;
}>();

const emit = defineEmits<{ apply: []; verify: []; finish: [] }>();

/** A string to translate in the template, with what it has to fill in. */
interface Phrase {
  key: string;
  values: unknown[];
}

/** Which of the panel's headings fits what the numbers on it are. */
const heading = computed(() => {
  if (applyResult) return "applied_heading";
  return verifying ? "verify_heading" : "measured_heading";
});

/** Whether the server wrote a delay to any speaker, so there is one to check or undo. */
const wrote = computed(
  () => applyResult !== null && Object.keys(applyResult.applied).length > 0,
);

/**
 * The delay each speaker is about to be given, worked out the way the server will.
 *
 * The server leaves the earliest speaker where it is and brings every later one
 * forward to meet it, on top of the delay each already carries. A session takes
 * those delays off before it measures, so on a first walk that is the readings
 * alone. On a walk repeated over applied delays it is not, and no figure is
 * offered: the server knows what the speakers carry and this page does not.
 */
const planned = computed<Record<string, number> | null>(() => {
  if (verifying) return null;
  const offsets = Object.values(fit.offsetsMs);
  if (!offsets.length || selected.some((id) => !(id in fit.offsetsMs)))
    return null;
  const earliest = Math.min(...offsets);
  return Object.fromEntries(
    Object.entries(fit.offsetsMs).map(([playerId, offset]) => [
      playerId,
      Math.round(offset - earliest),
    ]),
  );
});

const byId = computed(
  () => new Map(players.map((player) => [player.player_id, player])),
);

/** The speaker's name, falling back to its id if the server stopped listing it. */
function nameOf(playerId: string): string {
  return byId.value.get(playerId)?.name ?? playerId;
}

const anchorName = computed(() => (anchor ? nameOf(anchor) : ""));

/** Whether this run's offsets are readings at all, however far they can be trusted. */
const usable = computed(
  () => verdict !== "irreconcilable" && verdict !== "unindexable",
);

/** Every measured speaker's own scatter, worst first, so the odd one out leads. */
const scatterRows = computed(() =>
  Object.entries(fit.scatterMs)
    .sort(([, left], [, right]) => right - left)
    .map(([playerId, scatter]) => ({
      playerId,
      name: nameOf(playerId),
      scatter: scatter.toFixed(2),
    })),
);

/** The worst single recording's loss, as a percentage for the reader. */
const lostPercent = computed(() => (loss.worstFraction * 100).toFixed(1));

/** The readings the verdict's wording needs filled in. */
const verdictValues = computed(() => {
  switch (verdict) {
    case "lossy":
      return [lostPercent.value, MAX_LOST_FRACTION * 100];
    case "unindexable":
      return [offsetSpanMs(fit).toFixed(0), MAX_OFFSET_SPAN_MS];
    case "irreconcilable":
      return [fit.rateErrorPpm.toFixed(0), MAX_PLAUSIBLE_RATE_PPM];
    case "unmeasured":
      return [unheard.value.join(", ")];
    case "unbracketed":
    case "short_bracket":
      return [anchorName.value];
    case "scattered":
      return [
        Math.max(fit.residualMs, worstSpreadMs(fit)).toFixed(2),
        SCATTER_LIMIT_MS,
      ];
    case "pinned":
      return [Math.round((fit.bracketSpanSeconds ?? 0) / 60)];
    default:
      return [(fit.bracketResidualMs ?? 0).toFixed(2), BRACKET_LIMIT_MS];
  }
});

/** Speakers the walk never actually heard, by name. */
const unheard = computed(() =>
  selected.filter((playerId) => !(playerId in fit.offsetsMs)).map(nameOf),
);

/**
 * One row per speaker the run set out to measure — not per speaker it managed to.
 *
 * A speaker with no offset is listed as unheard rather than left out. Omitting it
 * would be worse than useless: the server re-normalises the delays of the
 * speakers it is given, so a silently missing one keeps its old delay while
 * everything else moves around it.
 */
const rows = computed(() =>
  selected.map((playerId) => {
    const manual = applyResult?.manual[playerId] ?? null;
    const applied = applyResult?.applied[playerId] ?? null;
    const offset =
      playerId in fit.offsetsMs ? fit.offsetsMs[playerId].toFixed(2) : null;
    const reading: Phrase = {
      key: `${KEYS}.results.milliseconds`,
      values: [offset],
    };
    const plan = planned.value?.[playerId] ?? null;
    const adjustable = byId.value.get(playerId)?.adjustable ?? false;

    // What to do with this speaker, and under it the reading that says why.
    let action = reading;
    let detail: Phrase | null = null;
    if (manual !== null) {
      action = { key: `${KEYS}.manual.row`, values: [manual] };
      detail = reading;
    } else if (applied !== null) {
      action = {
        key: `${KEYS}.results.applied_delay`,
        values: [applied, applyResult?.previous?.[playerId] ?? 0],
      };
      detail = reading;
    } else if (!applyResult && trustworthy && plan !== null) {
      action = {
        key: adjustable
          ? `${KEYS}.results.planned_delay`
          : `${KEYS}.manual.row`,
        values: [plan],
      };
      detail = reading;
    }

    return {
      playerId,
      name: nameOf(playerId),
      action,
      detail,
      // Which speakers need a hand is the server's call, and it only makes it at
      // write time — a speaker it expected to take a delay can still come back
      // under `manual`. Its own flag stands in until then, defaulting to needing
      // one for a speaker it no longer lists: claiming otherwise would promise an
      // adjustment nothing is going to make.
      byHand: applyResult ? manual !== null : !adjustable,
      offset,
      manual,
    };
  }),
);

/** The speakers the server left a delay to be added by hand on, by name. */
const manualNames = computed(() =>
  rows.value.filter((row) => row.manual !== null).map((row) => row.name),
);
</script>
