<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent
      class="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-[560px]"
      @escape-key-down="onGuardedClose"
      @pointer-down-outside="onGuardedClose"
      @interact-outside="onGuardedClose"
    >
      <!-- Header -->
      <DialogHeader
        class="flex-row items-center gap-3 border-b px-5 py-4 pr-12 text-left"
      >
        <span class="flex shrink-0 items-center justify-center">
          <ProviderIcon v-if="iconDomain" :domain="iconDomain" :size="32" />
          <Settings2 v-else :size="28" />
        </span>
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <DialogTitle class="truncate">{{ flowTitle }}</DialogTitle>
          <DialogDescription
            v-if="stepTitle"
            class="text-foreground truncate font-medium"
          >
            {{ stepTitle }}
          </DialogDescription>
        </div>
      </DialogHeader>

      <!-- Body -->
      <div class="min-h-[120px] flex-1 overflow-y-auto px-5 py-5">
        <!-- Starting / loading state (no step yet) -->
        <div v-if="!step" class="flex items-center justify-center py-8">
          <Spinner class="text-primary size-11" />
        </div>

        <!-- FORM step -->
        <template v-else-if="step.type === FlowStepType.FORM">
          <MarkdownText
            v-if="step.description"
            :text="step.description"
            class="text-muted-foreground mb-4 text-sm leading-relaxed"
          />

          <!-- base (non-field) error -->
          <Alert
            v-if="step.errors && step.errors.base"
            variant="destructive"
            class="mb-4"
          >
            <AlertDescription>{{ step.errors.base }}</AlertDescription>
          </Alert>

          <form ref="formRef" @submit.prevent="submit">
            <div
              v-for="entry in visibleFormEntries"
              :key="entry.key"
              class="mb-1"
            >
              <ConfigEntryRow
                :conf-entry="entry"
                :show-password-values="showPasswordValues"
                :disabled="busy || isDisabled(entry)"
                @update:value="onValueUpdate(entry, $event)"
                @toggle-password="showPasswordValues = !showPasswordValues"
                @help="onEntryHelp(entry)"
              />
              <div
                v-if="step.errors && step.errors[entry.key]"
                class="text-destructive mb-2.5 ml-0.5 text-xs"
              >
                {{ step.errors[entry.key] }}
              </div>
            </div>
            <!-- enables implicit (Enter) submission on multi-field forms -->
            <button
              type="submit"
              class="sr-only"
              tabindex="-1"
              aria-hidden="true"
            ></button>
          </form>
        </template>

        <!-- EXTERNAL step -->
        <template v-else-if="step.type === FlowStepType.EXTERNAL">
          <MarkdownText
            :text="
              step.description ??
              $t('settings.setup_flow.external_default_text')
            "
            class="text-muted-foreground mb-4 text-sm leading-relaxed"
          />
          <div
            class="flex w-full flex-col items-center justify-center gap-4 py-3 text-center"
          >
            <Button size="lg" @click="openExternal">
              <ExternalLink :size="18" />
              {{ $t("settings.setup_flow.open_external") }}
            </Button>
            <div
              v-if="externalHost"
              class="text-muted-foreground flex items-center gap-1.5 text-xs"
            >
              <ShieldCheck :size="13" />
              <span>{{
                $t("settings.setup_flow.external_host", [externalHost])
              }}</span>
            </div>
            <div class="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner class="size-4.5" />
              <span>{{ $t("settings.setup_flow.external_waiting") }}</span>
            </div>
            <a
              class="text-primary text-sm hover:underline"
              :href="step.url || '#'"
              target="_blank"
              rel="noopener"
              >{{ $t("settings.setup_flow.external_fallback") }}</a
            >
          </div>
        </template>

        <!-- PROGRESS step -->
        <template v-else-if="step.type === FlowStepType.PROGRESS">
          <div
            class="flex w-full flex-col items-center justify-center gap-4 py-3 text-center"
          >
            <img
              v-if="step.image"
              :src="step.image"
              alt=""
              class="max-h-[220px] max-w-[220px] rounded-lg"
              loading="lazy"
            />
            <Spinner
              v-if="step.progress === null || step.progress === undefined"
              class="text-primary size-13"
            />
            <Progress
              v-else
              :model-value="(step.progress || 0) * 100"
              class="w-full max-w-[320px]"
            />
            <MarkdownText
              v-if="step.progress_text"
              :text="step.progress_text"
              class="text-muted-foreground w-full text-sm leading-relaxed"
            />
          </div>
        </template>

        <!-- FINISH step -->
        <template v-else-if="step.type === FlowStepType.FINISH">
          <div
            class="flex flex-col items-center justify-center gap-3 py-3 text-center"
          >
            <span
              class="flex size-[72px] items-center justify-center rounded-full bg-green-500/15 text-green-600 dark:text-green-500"
            >
              <CircleCheck :size="40" />
            </span>
            <h3 class="text-base font-semibold">
              {{ step.title ?? $t("settings.setup_flow.success_title") }}
            </h3>
            <MarkdownText
              v-if="step.description"
              :text="step.description"
              class="text-muted-foreground w-full text-sm leading-relaxed"
            />
          </div>
        </template>

        <!-- ABORT step -->
        <template v-else-if="step.type === FlowStepType.ABORT">
          <div
            class="flex flex-col items-center justify-center gap-3 py-3 text-center"
          >
            <span
              v-if="isSessionEnded"
              class="bg-muted text-muted-foreground flex size-[72px] items-center justify-center rounded-full"
            >
              <Info :size="40" />
            </span>
            <span
              v-else
              class="flex size-[72px] items-center justify-center rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
            >
              <TriangleAlert :size="40" />
            </span>
            <h3 class="text-base font-semibold">
              {{
                step.title ??
                (isSessionEnded
                  ? $t("settings.setup_flow.session_ended_title")
                  : $t("settings.setup_flow.aborted_title"))
              }}
            </h3>
            <MarkdownText
              :text="step.reason || $t('settings.setup_flow.aborted_text')"
              class="text-muted-foreground w-full text-sm leading-relaxed"
            />
          </div>
        </template>
      </div>

      <!-- Actions -->
      <DialogFooter v-if="step" class="items-center border-t px-4 py-3">
        <div
          v-if="countdownText"
          class="text-muted-foreground mr-auto flex items-center gap-1.5 text-xs"
        >
          <Clock :size="14" />
          <span>{{ countdownText }}</span>
        </div>

        <template v-if="step.type === FlowStepType.FORM">
          <Button variant="ghost" :disabled="busy" @click="close()">
            {{ $t("cancel") }}
          </Button>
          <!-- a step that submits on pick has nothing left to confirm -->
          <Button
            v-if="!autoAdvanceEntry"
            :disabled="!canSubmit"
            @click="submit"
          >
            <Spinner v-if="busy" class="size-4" />
            {{
              step.last_step
                ? $t("settings.setup_flow.finish")
                : $t("settings.setup_flow.next")
            }}
          </Button>
          <div
            v-else-if="busy"
            class="flex h-9 items-center justify-center px-4"
          >
            <Spinner class="size-4" />
          </div>
        </template>

        <template
          v-else-if="
            step.type === FlowStepType.EXTERNAL ||
            step.type === FlowStepType.PROGRESS
          "
        >
          <Button variant="ghost" @click="close()">{{ $t("cancel") }}</Button>
        </template>

        <template v-else-if="step.type === FlowStepType.FINISH">
          <Button
            v-if="canOpenInstanceSettings"
            variant="ghost"
            @click="openInstanceSettings"
          >
            {{ $t("settings.setup_flow.open_settings") }}
          </Button>
          <Button @click="close(false)">
            {{ $t("settings.setup_flow.done") }}
          </Button>
        </template>

        <template v-else-if="step.type === FlowStepType.ABORT">
          <Button @click="close(false)">{{ $t("close") }}</Button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Per-field help dialog -->
  <Dialog :open="helpEntry !== undefined" @update:open="onHelpOpenChange">
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{{ helpEntry?.label }}</DialogTitle>
      </DialogHeader>
      <MarkdownText
        :text="helpEntry?.description"
        class="text-muted-foreground text-sm"
      />
      <DialogFooter>
        <Button
          v-if="helpEntry?.help_link"
          variant="outline"
          @click="openLink(helpEntry!.help_link!)"
        >
          {{ $t("read_more") }}
        </Button>
        <Button @click="helpEntry = undefined">{{ $t("close") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import MarkdownText from "@/components/MarkdownText.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { serverNow } from "@/composables/useServerTime";
import {
  allRequiredValuesPresent,
  isEntryDisabled,
  NON_INTERACTIVE_ENTRY_TYPES,
  VALUELESS_ENTRY_TYPES,
} from "@/helpers/config_entry_ui";
import { api, ConnectionState } from "@/plugins/api";
import {
  type ConfigEntry,
  ConfigEntryType,
  type ConfigValueType,
  FlowStepType,
  SECURE_STRING_SUBSTITUTE,
  SILENT_FINISH_STEP_ID,
  type SetupFlowStep,
} from "@/plugins/api/interfaces";
import { eventbus, type SetupFlowDialogEvent } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  CircleCheck,
  Clock,
  ExternalLink,
  Info,
  Settings2,
  ShieldCheck,
  TriangleAlert,
} from "@lucide/vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import ConfigEntryRow from "@/views/settings/ConfigEntryRow.vue";

const router = useRouter();

const open = ref(false);
const busy = ref(false);
const step = ref<SetupFlowStep | null>(null);
const launch = ref<SetupFlowDialogEvent | null>(null);
const formEntries = ref<ConfigEntry[]>([]);
const showPasswordValues = ref(false);
const helpEntry = ref<ConfigEntry | undefined>(undefined);
// on the server's clock, since the step's `expires_at` is a server timestamp
const now = ref(serverNow());

const formRef = ref<HTMLFormElement | null>(null);

// monotonically increasing launch token; guards async step application
let launchSeq = 0;
// bumped whenever the dialog moves to another step; guards a late response from
// overwriting a newer step that a push update already applied (flow_id alone
// never changes mid-flow, so it can't be used for that)
let stepSeq = 0;
let completionNotified = false;

let unsubscribeFlow: (() => void) | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;
// one-shot guard so an expired step triggers a single reconcile fetch
let expiryReconciledFor: string | null = null;

// step_id of the abort step this dialog synthesizes when the flow is gone after a
// reconnect; the double underscores keep it out of reach of server-sent slugs
const SESSION_ENDED_STEP_ID = "__session_ended__";

// terminal steps: closing them must not abort (the flow already ended server-side)
const isTerminal = computed(
  () =>
    step.value?.type === FlowStepType.FINISH ||
    step.value?.type === FlowStepType.ABORT,
);

// the synthesized abort is not a failure (the flow may well have completed while we
// were disconnected), so it gets neutral wording and styling instead of a warning
const isSessionEnded = computed(
  () =>
    step.value?.type === FlowStepType.ABORT &&
    step.value?.step_id === SESSION_ENDED_STEP_ID,
);

// while awaiting a submit response the dialog can't be dismissed accidentally
const isBusyStep = computed(() => busy.value);

const iconDomain = computed(() => {
  if (!launch.value) return undefined;
  if (launch.value.kind === "provider") return launch.value.domain;
  if (launch.value.kind === "reconfigure")
    return api.providers[launch.value.instanceId]?.domain;
  if (launch.value.kind === "player")
    return api.players[launch.value.playerId]?.provider
      ? api.getProviderManifest(api.players[launch.value.playerId].provider)
          ?.domain
      : undefined;
  return undefined;
});

// names what the flow is setting up; heads the dialog for every step
const flowTitle = computed(() => {
  if (!launch.value) return "";
  if (launch.value.kind === "provider") {
    const name =
      api.getProviderManifest(launch.value.domain)?.name || launch.value.domain;
    return $t("settings.setup_flow.setup_title", [name]);
  }
  if (launch.value.kind === "reconfigure") {
    return $t("settings.reconfigure");
  }
  // the launch event carries only the id, so the player need not be in the store
  const player = api.players[launch.value.playerId];
  return player
    ? $t("settings.setup_flow.setup_title", [player.name])
    : $t("settings.setup_flow.setup_player_title");
});

// the step's own title, shown under the flow title. Only the steps the user acts on
// hoist it; the finish and abort screens keep theirs next to their status icon
const stepTitle = computed(() => {
  if (step.value?.type === FlowStepType.FORM) return step.value.title || "";
  if (step.value?.type === FlowStepType.EXTERNAL) {
    return step.value.title || $t("settings.setup_flow.external_default_title");
  }
  return "";
});

const visibleFormEntries = computed(() =>
  formEntries.value.filter(
    (entry) =>
      !entry.hidden &&
      // an unmet dependency can only be expressed by hiding these types
      !(NON_INTERACTIVE_ENTRY_TYPES.includes(entry.type) && isDisabled(entry)),
  ),
);

const canSubmit = computed(
  () => !busy.value && allRequiredValuesPresent(formEntries.value),
);

// A step whose only field is a required list of options has nothing else to
// fill in, so picking one submits it.
const autoAdvanceEntry = computed(() => {
  const interactive = visibleFormEntries.value.filter(
    (entry) => !NON_INTERACTIVE_ENTRY_TYPES.includes(entry.type),
  );
  if (interactive.length !== 1) return undefined;
  const entry = interactive[0];
  const isExpandedChoice =
    entry.options.length > 0 && entry.expanded_options && !entry.multi_value;
  return entry.required && isExpandedChoice ? entry : undefined;
});

const canOpenInstanceSettings = computed(
  () => launch.value?.kind === "provider" && !!step.value?.result?.instance_id,
);

const countdownRemaining = computed(() => {
  const expiresAt = step.value?.expires_at;
  if (!expiresAt) return null;
  return Math.max(0, Math.round(expiresAt - now.value));
});

const countdownText = computed(() => {
  if (countdownRemaining.value === null) return "";
  const mins = Math.floor(countdownRemaining.value / 60);
  const secs = countdownRemaining.value % 60;
  const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;
  return $t("settings.setup_flow.expires_in", [formatted]);
});

onMounted(() => {
  eventbus.on("setupFlowDialog", onLaunch);
});

onBeforeUnmount(() => {
  eventbus.off("setupFlowDialog", onLaunch);
  cleanupFlow();
  stopCountdown();
});

// re-sync the current step after a websocket drop. CONNECTED fires before the
// connection is (re)authenticated, so a fetch on that signal would be rejected
// and wrongly present a still-alive flow as aborted - wait for AUTHENTICATED.
watch(
  () => api.state.value,
  (state, prev) => {
    if (
      state === ConnectionState.AUTHENTICATED &&
      prev !== ConnectionState.AUTHENTICATED
    ) {
      reconcileFlow();
    }
  },
);

// the countdown ticker only needs to run while the dialog is open
watch(open, (isOpen) => (isOpen ? startCountdown() : stopCountdown()));

// when a step's deadline elapses the server pushes the follow-up step; fetch
// once as a safety net so a missed push can't leave a stale form on screen
watch(countdownRemaining, (remaining) => {
  if (remaining !== 0 || !step.value || isTerminal.value) return;
  const key = `${step.value.flow_id}:${step.value.step_id}`;
  if (expiryReconciledFor === key) return;
  expiryReconciledFor = key;
  reconcileFlow();
});

function startCountdown() {
  now.value = serverNow();
  if (!countdownTimer) {
    countdownTimer = setInterval(() => {
      now.value = serverNow();
    }, 1000);
  }
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

async function onLaunch(evt: SetupFlowDialogEvent) {
  // starting a new flow replaces any currently open one
  if (open.value) close();
  // identity on launch.value cannot be used for staleness checks: the ref
  // proxy-wraps the stored event, so it never equals the raw evt again
  const seq = ++launchSeq;
  completionNotified = false;
  launch.value = evt;
  step.value = null;
  busy.value = true;
  open.value = true;
  store.dialogActive = true;
  try {
    const firstStep = await startFlow(evt);
    // the dialog may have been closed (or relaunched) while the request ran
    if (!open.value || seq !== launchSeq) return;
    applyStep(firstStep);
  } catch (err) {
    toast.error(String(err));
    close();
  } finally {
    busy.value = false;
  }
}

function startFlow(evt: SetupFlowDialogEvent): Promise<SetupFlowStep> {
  if (evt.kind === "provider") return api.setupProvider(evt.domain);
  if (evt.kind === "reconfigure")
    return api.reconfigureProvider(evt.instanceId);
  return api.setupPlayer(evt.playerId);
}

function applyStep(newStep: SetupFlowStep) {
  const prevFlowId = step.value?.flow_id;
  const prevStepId = step.value?.step_id;
  // only a real step change invalidates in-flight requests: the same step being
  // re-served (reconcile, validation errors) must not discard their responses
  if (prevFlowId !== newStep.flow_id || prevStepId !== newStep.step_id) {
    stepSeq++;
  }
  step.value = newStep;

  // subscribe to push updates for non-terminal flows (external/progress advance this way)
  if (
    newStep.type !== FlowStepType.FINISH &&
    newStep.type !== FlowStepType.ABORT &&
    !unsubscribeFlow
  ) {
    unsubscribeFlow = api.subscribeSetupFlow(newStep.flow_id, applyStep);
  }
  if (isTerminal.value && unsubscribeFlow) {
    unsubscribeFlow();
    unsubscribeFlow = null;
  }
  if (
    isTerminal.value &&
    !completionNotified &&
    (launch.value?.kind === "reconfigure" || launch.value?.kind === "player")
  ) {
    completionNotified = true;
    launch.value.onFlowEnded?.(newStep.type === FlowStepType.FINISH);
  }

  // a silent finish (e.g. a one-click device approval) needs no success screen
  if (
    newStep.type === FlowStepType.FINISH &&
    newStep.step_id === SILENT_FINISH_STEP_ID
  ) {
    close(false);
    return;
  }

  if (newStep.type === FlowStepType.FORM) {
    // preserve typed values when the same form is re-served with validation errors
    const sameForm =
      prevFlowId === newStep.flow_id && prevStepId === newStep.step_id;
    buildForm(newStep, sameForm);
    if (!sameForm) {
      // move focus into the fresh form for keyboard/screen-reader users
      nextTick(() => {
        formRef.value
          ?.querySelector<HTMLElement>("input:not([type=hidden]), textarea")
          ?.focus();
      });
    }
  } else {
    formEntries.value = [];
  }
}

function buildForm(formStep: SetupFlowStep, preserveValues: boolean) {
  const previous: Record<string, ConfigValueType | undefined> = {};
  if (preserveValues) {
    for (const entry of formEntries.value) previous[entry.key] = entry.value;
  }
  formEntries.value = formStep.entries.map((entry) => {
    const copy: ConfigEntry = { ...entry };
    if (preserveValues && entry.key in previous) {
      copy.value = previous[entry.key];
    } else if (copy.value === undefined || copy.value === null) {
      copy.value = copy.default_value;
    }
    return copy;
  });
}

function onValueUpdate(entry: ConfigEntry, value: ConfigValueType) {
  entry.value = value;
  if (entry.key === autoAdvanceEntry.value?.key) {
    // submit() re-checks canSubmit, so the fresh value needs no validation here
    void submit();
  }
}

async function submit() {
  if (!step.value || !canSubmit.value) return;
  const values: Record<string, ConfigValueType> = {};
  for (const entry of formEntries.value) {
    if (VALUELESS_ENTRY_TYPES.includes(entry.type)) continue;
    let value = entry.value;
    if (value === undefined) value = null;
    // don't send back the obfuscated placeholder for unchanged secure strings
    if (
      entry.type === ConfigEntryType.SECURE_STRING &&
      value === SECURE_STRING_SUBSTITUTE
    ) {
      continue;
    }
    values[entry.key] = value ?? null;
  }
  busy.value = true;
  const flowId = step.value.flow_id;
  const seq = stepSeq;
  try {
    const nextStep = await api.submitSetupFlow(flowId, values);
    // the dialog may have been closed, a new flow started, or a pushed update
    // already advanced us past this step while the request ran
    if (!open.value || seq !== stepSeq) return;
    applyStep(nextStep);
  } catch (err) {
    toast.error(String(err));
  } finally {
    busy.value = false;
  }
}

// the host of the external step's URL, shown as a trust cue under the Open button
const externalHost = computed(() => {
  if (!step.value?.url) return null;
  try {
    return new URL(step.value.url).host;
  } catch {
    return null;
  }
});

function openExternal() {
  if (!step.value?.url) return;
  // iOS-safe: perform a programmatic anchor click within this user gesture
  // instead of window.open (which mobile browsers may block).
  const a = document.createElement("a");
  a.setAttribute("href", step.value.url);
  a.setAttribute("target", "_blank");
  a.setAttribute("rel", "noopener");
  a.click();
}

function openLink(url: string) {
  const a = document.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("target", "_blank");
  a.setAttribute("rel", "noopener");
  a.click();
}

function openInstanceSettings() {
  const instanceId = step.value?.result?.instance_id;
  if (!instanceId) return;
  close(false);
  router.push(`/settings/editprovider/${instanceId}`);
}

function reconcileFlow() {
  // re-fetch the current step; if the flow is gone server-side, end the dialog neutrally
  if (!open.value || !step.value || isTerminal.value) return;
  const flowId = step.value.flow_id;
  const seq = stepSeq;
  api
    .getSetupFlow(flowId)
    .then((current) => {
      if (!open.value || seq !== stepSeq) return;
      applyStep(current);
    })
    .catch(() => {
      if (!open.value || seq !== stepSeq) return;
      cleanupFlow();
      applyStep({
        flow_id: flowId,
        step_id: SESSION_ENDED_STEP_ID,
        type: FlowStepType.ABORT,
        entries: [],
        errors: {},
        reason: $t("settings.setup_flow.session_ended_text"),
      });
    });
}

function onOpenChange(value: boolean) {
  if (!value) close();
}

// block accidental dismissal (escape / click-outside) while a submit is in flight;
// the explicit close button stays active, matching the previous behaviour
function onGuardedClose(event: Event) {
  if (isBusyStep.value) {
    event.preventDefault();
    return;
  }
  // Vuetify menus/overlays (e.g. a select dropdown or date picker inside a form
  // step) teleport OUTSIDE the dialog DOM, so Reka would treat interacting with
  // them as an outside click and dismiss the whole dialog. Keep it open when the
  // interaction lands inside a Vuetify overlay.
  const original = (event as CustomEvent).detail?.originalEvent as
    | Event
    | undefined;
  const target = (original?.target ?? event.target) as HTMLElement | null;
  if (target?.closest?.(".v-overlay-container, .v-overlay, .v-menu")) {
    event.preventDefault();
  }
}

function onHelpOpenChange(value: boolean) {
  if (!value) helpEntry.value = undefined;
}

function close(sendAbort = true) {
  if (sendAbort && step.value && !isTerminal.value && step.value.flow_id) {
    // fire-and-forget: cancel the running flow server-side
    api.abortSetupFlow(step.value.flow_id).catch(() => undefined);
  }
  open.value = false;
  store.dialogActive = false;
  cleanupFlow();
  // invalidate any in-flight request so it can't apply a step onto a relaunch
  stepSeq++;
  step.value = null;
  launch.value = null;
  formEntries.value = [];
  busy.value = false;
  showPasswordValues.value = false;
  helpEntry.value = undefined;
}

function cleanupFlow() {
  if (unsubscribeFlow) {
    unsubscribeFlow();
    unsubscribeFlow = null;
  }
}

function onEntryHelp(entry: ConfigEntry) {
  if (entry.description) helpEntry.value = entry;
  else if (entry.help_link) openLink(entry.help_link);
}

function isDisabled(entry: ConfigEntry): boolean {
  return isEntryDisabled(entry, formEntries.value);
}
</script>
