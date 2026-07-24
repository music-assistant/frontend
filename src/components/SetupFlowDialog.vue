<template>
  <v-dialog
    :model-value="open"
    max-width="560"
    scrollable
    :persistent="isBusyStep"
    @update:model-value="onDialogModelValue"
  >
    <v-card class="setup-flow-card">
      <!-- Header -->
      <div class="flow-header">
        <div class="flow-header-icon">
          <provider-icon v-if="iconDomain" :domain="iconDomain" :size="32" />
          <Settings2 v-else :size="28" />
        </div>
        <div class="flow-header-title">{{ dialogTitle }}</div>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          density="comfortable"
          :aria-label="$t('close')"
          @click="close()"
        />
      </div>

      <v-divider />

      <v-card-text class="flow-body">
        <!-- Starting / loading state (no step yet) -->
        <div v-if="!step" class="flow-centered">
          <v-progress-circular indeterminate size="48" color="primary" />
        </div>

        <!-- FORM step -->
        <template v-else-if="step.type === FlowStepType.FORM">
          <h3 v-if="step.title" class="flow-step-title">{{ step.title }}</h3>
          <p v-if="step.description" class="flow-step-description">
            {{ step.description }}
          </p>

          <!-- base (non-field) error -->
          <v-alert
            v-if="step.errors && step.errors.base"
            type="error"
            variant="tonal"
            density="comfortable"
            class="mb-4"
          >
            {{ step.errors.base }}
          </v-alert>

          <v-form @submit.prevent="submit">
            <div
              v-for="entry in visibleFormEntries"
              :key="entry.key"
              class="flow-field"
            >
              <ConfigEntryRow
                :conf-entry="entry"
                :show-password-values="showPasswordValues"
                :disabled="busy || isEntryDisabled(entry)"
                @update:value="onValueUpdate(entry, $event)"
                @toggle-password="showPasswordValues = !showPasswordValues"
                @help="onEntryHelp(entry)"
              />
              <div
                v-if="step.errors && step.errors[entry.key]"
                class="flow-field-error"
              >
                {{ step.errors[entry.key] }}
              </div>
            </div>
          </v-form>

          <div v-if="countdownText" class="flow-countdown">
            <Clock :size="14" />
            <span>{{ countdownText }}</span>
          </div>
        </template>

        <!-- EXTERNAL step -->
        <template v-else-if="step.type === FlowStepType.EXTERNAL">
          <h3 v-if="step.title" class="flow-step-title">{{ step.title }}</h3>
          <p v-if="step.description" class="flow-step-description">
            {{ step.description }}
          </p>
          <div class="flow-centered flow-external">
            <v-btn
              color="primary"
              size="large"
              prepend-icon="mdi-open-in-new"
              @click="openExternal"
            >
              {{ $t("settings.setup_flow.open_external") }}
            </v-btn>
            <div class="flow-external-waiting">
              <v-progress-circular indeterminate size="18" width="2" />
              <span>{{ $t("settings.setup_flow.external_waiting") }}</span>
            </div>
            <a
              class="flow-external-fallback"
              :href="step.url || '#'"
              target="_blank"
              rel="noopener"
              >{{ $t("settings.setup_flow.external_fallback") }}</a
            >
          </div>
          <div v-if="countdownText" class="flow-countdown">
            <Clock :size="14" />
            <span>{{ countdownText }}</span>
          </div>
        </template>

        <!-- PROGRESS step -->
        <template v-else-if="step.type === FlowStepType.PROGRESS">
          <div class="flow-centered flow-progress">
            <img
              v-if="step.image"
              :src="step.image"
              alt=""
              class="flow-progress-image"
            />
            <v-progress-circular
              v-if="step.progress === null || step.progress === undefined"
              indeterminate
              size="52"
              color="primary"
            />
            <v-progress-linear
              v-else
              :model-value="(step.progress || 0) * 100"
              color="primary"
              height="8"
              rounded
              class="flow-progress-bar"
            />
            <p
              v-if="step.progress_text"
              class="flow-step-description flow-progress-text"
            >
              {{ step.progress_text }}
            </p>
            <div v-if="countdownText" class="flow-countdown">
              <Clock :size="14" />
              <span>{{ countdownText }}</span>
            </div>
          </div>
        </template>

        <!-- FINISH step -->
        <template v-else-if="step.type === FlowStepType.FINISH">
          <div class="flow-centered flow-terminal">
            <div class="flow-terminal-icon flow-terminal-icon--success">
              <CircleCheck :size="40" />
            </div>
            <h3 class="flow-step-title">
              {{ step.title || $t("settings.setup_flow.success_title") }}
            </h3>
            <p v-if="step.description" class="flow-step-description">
              {{ step.description }}
            </p>
          </div>
        </template>

        <!-- ABORT step -->
        <template v-else-if="step.type === FlowStepType.ABORT">
          <div class="flow-centered flow-terminal">
            <div class="flow-terminal-icon flow-terminal-icon--abort">
              <TriangleAlert :size="40" />
            </div>
            <h3 class="flow-step-title">
              {{ step.title || $t("settings.setup_flow.aborted_title") }}
            </h3>
            <p class="flow-step-description">
              {{ step.reason || $t("settings.setup_flow.aborted_text") }}
            </p>
          </div>
        </template>
      </v-card-text>

      <v-divider />

      <!-- Actions -->
      <v-card-actions class="flow-actions">
        <template v-if="step && step.type === FlowStepType.FORM">
          <v-spacer />
          <v-btn variant="text" :disabled="busy" @click="close()">
            {{ $t("cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="busy"
            :disabled="!canSubmit"
            @click="submit"
          >
            {{
              step.last_step
                ? $t("settings.setup_flow.finish")
                : $t("settings.setup_flow.next")
            }}
          </v-btn>
        </template>

        <template
          v-else-if="
            step &&
            (step.type === FlowStepType.EXTERNAL ||
              step.type === FlowStepType.PROGRESS)
          "
        >
          <v-spacer />
          <v-btn variant="text" @click="close()">{{ $t("cancel") }}</v-btn>
        </template>

        <template v-else-if="step && step.type === FlowStepType.FINISH">
          <v-spacer />
          <v-btn
            v-if="canOpenInstanceSettings"
            variant="text"
            @click="openInstanceSettings"
          >
            {{ $t("settings.setup_flow.open_settings") }}
          </v-btn>
          <v-btn color="primary" variant="flat" @click="close(false)">
            {{ $t("settings.setup_flow.done") }}
          </v-btn>
        </template>

        <template v-else-if="step && step.type === FlowStepType.ABORT">
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="close(false)">
            {{ $t("close") }}
          </v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Per-field help dialog -->
  <v-dialog
    :model-value="helpEntry !== undefined"
    width="auto"
    max-width="480"
    @update:model-value="helpEntry = undefined"
  >
    <v-card>
      <v-card-title>{{ helpEntry?.label }}</v-card-title>
      <v-card-text style="white-space: pre-wrap">{{
        helpEntry?.description
      }}</v-card-text>
      <v-card-actions>
        <v-btn
          v-if="helpEntry?.help_link"
          @click="openLink(helpEntry!.help_link!)"
        >
          {{ $t("read_more") }}
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="helpEntry = undefined">
          {{ $t("close") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import {
  type ConfigEntry,
  ConfigEntryType,
  type ConfigValueType,
  EventType,
  FlowStepType,
  SECURE_STRING_SUBSTITUTE,
  type SetupFlowStep,
} from "@/plugins/api/interfaces";
import { eventbus, type SetupFlowDialogEvent } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { CircleCheck, Clock, Settings2, TriangleAlert } from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
const now = ref(Date.now() / 1000);

let unsubscribeFlow: (() => void) | null = null;
let unsubscribeConnected: (() => void) | null = null;
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// terminal steps: closing them must not abort (the flow already ended server-side)
const PRESENTATIONAL_TYPES = [
  ConfigEntryType.DIVIDER,
  ConfigEntryType.LABEL,
  ConfigEntryType.ALERT,
  ConfigEntryType.IMAGE,
  ConfigEntryType.ACTION,
];

const isTerminal = computed(
  () =>
    step.value?.type === FlowStepType.FINISH ||
    step.value?.type === FlowStepType.ABORT,
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

const dialogTitle = computed(() => {
  if (!launch.value) return "";
  if (launch.value.kind === "provider") {
    const name =
      api.getProviderManifest(launch.value.domain)?.name || launch.value.domain;
    return $t("settings.setup_provider", [name]);
  }
  if (launch.value.kind === "reconfigure") {
    return $t("settings.reconfigure");
  }
  return $t("settings.setup_flow.setup_player_title");
});

const visibleFormEntries = computed(() =>
  formEntries.value.filter((entry) => !entry.hidden),
);

const canSubmit = computed(() => {
  if (busy.value) return false;
  for (const entry of formEntries.value) {
    if (PRESENTATIONAL_TYPES.includes(entry.type)) continue;
    if (isEntryDisabled(entry)) continue;
    if (
      entry.required &&
      isNullOrUndefined(entry.value) &&
      isNullOrUndefined(entry.default_value)
    ) {
      return false;
    }
  }
  return true;
});

const canOpenInstanceSettings = computed(
  () => launch.value?.kind === "provider" && !!step.value?.result?.instance_id,
);

const countdownText = computed(() => {
  const expiresAt = step.value?.expires_at;
  if (!expiresAt) return "";
  const remaining = Math.max(0, Math.round(expiresAt - now.value));
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;
  return $t("settings.setup_flow.expires_in", [formatted]);
});

onMounted(() => {
  eventbus.on("setupFlowDialog", onLaunch);
  // re-render the current step after a websocket reconnect
  unsubscribeConnected = api.subscribe(
    EventType.CONNECTED,
    onReconnect,
  ) as () => void;
  countdownTimer = setInterval(() => {
    now.value = Date.now() / 1000;
  }, 1000);
});

onBeforeUnmount(() => {
  eventbus.off("setupFlowDialog", onLaunch);
  cleanupFlow();
  if (unsubscribeConnected) unsubscribeConnected();
  if (countdownTimer) clearInterval(countdownTimer);
});

async function onLaunch(evt: SetupFlowDialogEvent) {
  // starting a new flow replaces any currently open one
  if (open.value) close();
  launch.value = evt;
  step.value = null;
  busy.value = true;
  open.value = true;
  store.dialogActive = true;
  try {
    const firstStep = await startFlow(evt);
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

  if (newStep.type === FlowStepType.FORM) {
    // preserve typed values when the same form is re-served with validation errors
    const sameForm =
      prevFlowId === newStep.flow_id && prevStepId === newStep.step_id;
    buildForm(newStep, sameForm);
  } else {
    formEntries.value = [];
  }
}

function buildForm(formStep: SetupFlowStep, preserveValues: boolean) {
  const previous: Record<string, ConfigValueType | undefined> = {};
  if (preserveValues) {
    for (const entry of formEntries.value) previous[entry.key] = entry.value;
  }
  formEntries.value = (formStep.entries || []).map((entry) => {
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
}

async function submit() {
  if (!step.value || !canSubmit.value) return;
  const values: Record<string, ConfigValueType> = {};
  for (const entry of formEntries.value) {
    if (PRESENTATIONAL_TYPES.includes(entry.type)) continue;
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
  try {
    const nextStep = await api.submitSetupFlow(step.value.flow_id, values);
    applyStep(nextStep);
  } catch (err) {
    toast.error(String(err));
  } finally {
    busy.value = false;
  }
}

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

function onReconnect() {
  // after a reconnect, re-fetch the current step; if the flow is gone, show an abort
  if (!open.value || !step.value || isTerminal.value) return;
  const flowId = step.value.flow_id;
  api
    .getSetupFlow(flowId)
    .then((current) => applyStep(current))
    .catch(() => {
      cleanupFlow();
      step.value = {
        flow_id: flowId,
        step_id: "abort",
        type: FlowStepType.ABORT,
        entries: [],
        errors: {},
        reason: $t("settings.setup_flow.flow_gone"),
      };
    });
}

function onDialogModelValue(value: boolean) {
  if (!value) close();
}

function close(sendAbort = true) {
  if (sendAbort && step.value && !isTerminal.value && step.value.flow_id) {
    // fire-and-forget: cancel the running flow server-side
    api.abortSetupFlow(step.value.flow_id).catch(() => undefined);
  }
  open.value = false;
  store.dialogActive = false;
  cleanupFlow();
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

function isEntryDisabled(entry: ConfigEntry): boolean {
  if (isNullOrUndefined(entry.depends_on)) return false;
  const dependency = formEntries.value.find((e) => e.key === entry.depends_on);
  if (!dependency) return false;
  const dependencyValue = dependency.value;
  if (!isNullOrUndefined(entry.depends_on_value)) {
    return dependencyValue != entry.depends_on_value;
  }
  if (!isNullOrUndefined(entry.depends_on_value_not)) {
    return dependencyValue == entry.depends_on_value_not;
  }
  return !dependencyValue;
}

function isNullOrUndefined(value: unknown): boolean {
  return value === null || value === undefined;
}
</script>

<style scoped>
.setup-flow-card {
  display: flex;
  flex-direction: column;
  border-radius: 16px;
}

.flow-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 16px 20px;
}

.flow-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.flow-header-title {
  flex: 1;
  min-width: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: rgb(var(--v-theme-on-surface));
}

.flow-body {
  padding: 20px;
  min-height: 120px;
}

.flow-centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 0;
  text-align: center;
}

.flow-step-title {
  font-size: 1.05rem;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: rgb(var(--v-theme-on-surface));
}

.flow-step-description {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.75);
  line-height: 1.5;
  margin: 0 0 16px 0;
  white-space: pre-wrap;
}

.flow-field {
  margin-bottom: 4px;
}

.flow-field-error {
  color: rgb(var(--v-theme-error));
  font-size: 0.78rem;
  margin: -2px 0 10px 2px;
}

.flow-external {
  width: 100%;
}

.flow-external-waiting {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.flow-external-fallback {
  font-size: 0.82rem;
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.flow-external-fallback:hover {
  text-decoration: underline;
}

.flow-progress {
  width: 100%;
}

.flow-progress-bar {
  width: 100%;
  max-width: 320px;
}

.flow-progress-image {
  max-width: 220px;
  max-height: 220px;
  border-radius: 8px;
}

.flow-progress-text {
  margin: 0;
}

.flow-terminal {
  gap: 12px;
}

.flow-terminal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
}

.flow-terminal-icon--success {
  background: rgba(var(--v-theme-success), 0.15);
  color: rgb(var(--v-theme-success));
}

.flow-terminal-icon--abort {
  background: rgba(var(--v-theme-warning), 0.15);
  color: rgb(var(--v-theme-warning));
}

.flow-countdown {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 0.8rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.flow-actions {
  padding: 12px 16px;
  gap: 8px;
}
</style>
