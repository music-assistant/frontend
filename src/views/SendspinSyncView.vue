<template>
  <section class="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
    <header>
      <h1
        class="inline-flex items-center text-2xl font-semibold tracking-tight"
      >
        <Mic class="mr-2 h-5 w-5" aria-hidden="true" />
        {{ $t("providers.sendspin_sync.title") }}
      </h1>
      <p class="text-sm text-muted-foreground">{{ $t(`${KEYS}.subtitle`) }}</p>
    </header>

    <!-- A void is the whole run gone, so it is announced and it replaces the
         flow rather than sitting above it. -->
    <Card v-if="phase === 'voided'" class="gap-4">
      <CardHeader role="status" aria-live="polite">
        <CardTitle class="text-destructive">
          {{ $t(`${KEYS}.void.${voidReason}.title`) }}
        </CardTitle>
        <CardDescription>
          {{ $t(`${KEYS}.void.${voidReason}.description`) }}
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button @click="startOver">
          <RotateCcw class="size-4" aria-hidden="true" />
          {{ $t(`${KEYS}.void.restart`) }}
        </Button>
      </CardFooter>
    </Card>

    <template v-else>
      <!-- Known before anything is tapped: a page served without a secure
           connection has no microphone to ask for, and finding that out from a
           failed start would cost the user the reason. -->
      <Alert v-if="microphoneBlock" variant="destructive">
        <TriangleAlert class="h-4 w-4" aria-hidden="true" />
        <AlertTitle>
          {{ $t(`${PROBE_KEYS}.blocked.${microphoneBlock}.title`) }}
        </AlertTitle>
        <AlertDescription>
          {{ $t(`${PROBE_KEYS}.blocked.${microphoneBlock}.description`) }}
        </AlertDescription>
      </Alert>

      <Alert v-else-if="openError" variant="destructive">
        <TriangleAlert class="h-4 w-4" aria-hidden="true" />
        <AlertTitle>
          {{ $t(`${KEYS}.microphone_failed.${microphoneFailure}.title`) }}
        </AlertTitle>
        <AlertDescription>
          {{ $t(`${KEYS}.microphone_failed.${microphoneFailure}.description`) }}
        </AlertDescription>
      </Alert>

      <!-- The server's own reason for refusing something, as it gave it. It is
           the only account there is of what went wrong, and nearly always
           something the user can put right where they stand. -->
      <Alert v-if="sessionProblem" variant="destructive" role="alert">
        <TriangleAlert class="h-4 w-4" aria-hidden="true" />
        <AlertTitle>
          {{ $t(`${KEYS}.problem.${sessionProblem.kind}.title`) }}
        </AlertTitle>
        <AlertDescription>
          {{
            sessionProblem.kind === "refused"
              ? sessionProblem.message
              : $t(`${KEYS}.problem.unreachable.description`)
          }}
        </AlertDescription>
      </Alert>

      <!-- The server holds one session at a time, so starting would be refused.
           Whoever is mid-walk gets to say so rather than be cut off silently,
           and ending their run from here takes a second, deliberate tap. -->
      <Alert v-if="phase === 'picking' && sessionState" variant="warning">
        <TriangleAlert class="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{{ $t(`${KEYS}.in_progress.title`) }}</AlertTitle>
        <AlertDescription class="space-y-2">
          <p>{{ $t(`${KEYS}.in_progress.description`) }}</p>
          <Button
            size="sm"
            :variant="confirmingEnd ? 'destructive' : 'outline'"
            @click="endRunning"
          >
            {{
              $t(`${KEYS}.in_progress.${confirmingEnd ? "confirm" : "stop"}`)
            }}
          </Button>
        </AlertDescription>
      </Alert>

      <SendspinSyncPlayerPicker
        v-if="phase === 'picking'"
        v-model:selected="selected"
        :players="players"
        :disabled="busy || Boolean(sessionState)"
        :blocked="microphoneBlock !== null"
        :starting="starting"
        @start="start"
      />

      <template v-else>
        <SendspinSyncWalk
          :players="players"
          :selected="selected"
          :visits="visits"
          :anchor="anchor"
          :needs-bracket="needsBracket"
          :needs-check="needsCheck"
          :disabled="phase === 'measuring'"
          :measuring="measuringPlayerId"
          :seconds-left="secondsLeft"
          :closed="applyResult !== null"
          @measure="(playerId, replace) => measure(playerId, replace)"
          @clear="clearReadings"
          @stop="startOver"
        />

        <!-- Held back until the walk has nothing left to ask for: every speaker
             tried, and the first one measured a second time. Until then the
             panel could only say the run is not checked yet, in red, about a
             walk that is going exactly as it should. -->
        <SendspinSyncResults
          v-if="fit && verdict && remaining.length === 0 && !needsBracket"
          :players="players"
          :selected="selected"
          :fit="fit"
          :loss="loss"
          :spacing-seconds="spacingSeconds"
          :verdict="verdict"
          :apply-result="applyResult"
          :trustworthy="trustworthy"
          :anchor="anchor"
          :verifying="verifying"
          :disabled="busy || phase === 'measuring'"
          @apply="applyDelays"
          @verify="verify"
          @finish="startOver"
        />
      </template>
    </template>

    <!-- The full continuity capture takes thirty seconds and is only wanted when
         a measurement looks wrong, so it stays reachable rather than in the way.
         Not during a walk: it opens a microphone of its own, and a second one
         can take the first away. -->
    <Accordion
      v-if="phase === 'picking' || phase === 'voided'"
      type="single"
      collapsible
    >
      <AccordionItem value="probe">
        <AccordionTrigger>{{ $t(`${KEYS}.diagnostics`) }}</AccordionTrigger>
        <AccordionContent>
          <SendspinSyncProbe />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </section>
</template>

<script setup lang="ts">
import SendspinSyncPlayerPicker from "@/components/sendspin-sync/SendspinSyncPlayerPicker.vue";
import SendspinSyncProbe from "@/components/sendspin-sync/SendspinSyncProbe.vue";
import SendspinSyncResults from "@/components/sendspin-sync/SendspinSyncResults.vue";
import SendspinSyncWalk from "@/components/sendspin-sync/SendspinSyncWalk.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCalibrationRun } from "@/composables/sendspin-sync/useCalibrationRun";
import { $t } from "@/plugins/i18n";
import { Mic, RotateCcw, TriangleAlert } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import { toast } from "vue-sonner";

const KEYS = "providers.sendspin_sync.calibration";
const PROBE_KEYS = "providers.sendspin_sync.probe";

const {
  players,
  sessionState,
  sessionLost,
  sessionProblem,
  busy,
  phase,
  selected,
  visits,
  measuringPlayerId,
  secondsLeft,
  starting,
  verifying,
  anchor,
  needsBracket,
  needsCheck,
  remaining,
  fit,
  loss,
  spacingSeconds,
  verdict,
  trustworthy,
  applyResult,
  openError,
  loadPlayers,
  refresh,
  begin,
  measure,
  clearReadings,
  apply,
  verify,
  endAdopted,
  restart,
} = useCalibrationRun();

const voidReason = computed(() => sessionLost.value ?? "suspended");

/**
 * Why this browser cannot open a microphone at all, or `null` when it can try.
 *
 * Both are true or false for the life of the page, and both can be read without
 * asking for anything.
 */
const microphoneBlock: "insecure" | "no_api" | null = !window.isSecureContext
  ? "insecure"
  : typeof navigator.mediaDevices?.getUserMedia !== "function"
    ? "no_api"
    : null;

/** Which of the reasons a microphone would not open the browser gave. */
const microphoneFailure = computed(() => {
  switch (openError.value) {
    case "NotAllowedError":
    case "SecurityError":
      return "refused";
    case "NotFoundError":
    case "NotReadableError":
    case "OverconstrainedError":
    case "NoAudioTrackError":
      return "no_device";
    default:
      return "other";
  }
});

/** True between the first tap on ending somebody's run and the second. */
const confirmingEnd = ref(false);

onMounted(async () => {
  await refresh();
  await loadPlayers();
});

// Leaving the page hands the speakers back. The session's own inactivity timeout
// is a backstop against a phone that vanished, not this flow's cleanup path.
onBeforeRouteLeave(async () => {
  await restart();
});

window.addEventListener("pagehide", onPageHide);
onBeforeUnmount(() => window.removeEventListener("pagehide", onPageHide));

function onPageHide(): void {
  void restart();
}

async function start(force: boolean): Promise<void> {
  if (await begin(force)) toast.success($t(`${KEYS}.toast.started`));
}

/** Hand the run to the server, saying plainly whether anything was written. */
async function applyDelays(): Promise<void> {
  if (!(await apply())) return;
  const wrote = Object.keys(applyResult.value?.applied ?? {}).length > 0;
  toast.success($t(`${KEYS}.toast.${wrote ? "applied" : "manual"}`));
}

/** Give the speakers back, clear the run, and offer the picker again. */
async function startOver(): Promise<void> {
  await restart();
  await refresh();
  await loadPlayers();
  toast.success($t(`${KEYS}.toast.released`));
}

/** End a run this page did not start, on the second of two taps. */
async function endRunning(): Promise<void> {
  if (!confirmingEnd.value) {
    confirmingEnd.value = true;
    return;
  }
  confirmingEnd.value = false;
  await endAdopted();
  await refresh();
  await loadPlayers();
}
</script>
