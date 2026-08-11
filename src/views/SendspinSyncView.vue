<template>
  <section class="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
    <header>
      <h1
        class="inline-flex items-center text-2xl font-semibold tracking-tight"
      >
        <Mic class="mr-2 h-5 w-5" aria-hidden="true" />
        {{ $t("providers.sendspin_sync.title") }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ $t("providers.sendspin_sync.probe.subtitle") }}
      </p>
    </header>

    <Alert v-if="blocker" variant="warning">
      <TriangleAlert class="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{{ $t(`${blocker}.title`) }}</AlertTitle>
      <AlertDescription>{{ $t(`${blocker}.description`) }}</AlertDescription>
    </Alert>

    <Card class="gap-4">
      <CardHeader>
        <CardTitle>{{ $t(`${headline}.title`) }}</CardTitle>
        <CardDescription>{{ $t(`${headline}.description`) }}</CardDescription>
      </CardHeader>

      <CardContent class="space-y-4">
        <Button class="w-full sm:w-auto" :disabled="running" @click="run">
          <Spinner v-if="running" class="size-4" />
          <Mic v-else class="size-4" aria-hidden="true" />
          {{
            running
              ? $t("providers.sendspin_sync.probe.capturing")
              : report
                ? $t("providers.sendspin_sync.probe.restart")
                : $t("providers.sendspin_sync.probe.start")
          }}
        </Button>

        <div v-if="running" class="space-y-2" role="status" aria-live="polite">
          <Progress :model-value="captureProgress" />
          <p class="text-sm text-muted-foreground">
            {{
              $t("providers.sendspin_sync.probe.remaining", [
                captureRemainingSeconds,
              ])
            }}
          </p>
        </div>

        <ul v-if="checks.length" class="divide-y border-t">
          <li v-for="check in checks" :key="check.id" class="py-3">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium">{{ $t(check.titleKey) }}</p>
                <p class="text-sm text-muted-foreground">
                  {{ $t(check.hintKey) }}
                </p>
              </div>
              <Badge :variant="statusVariant[check.status]" class="shrink-0">
                {{ $t(`providers.sendspin_sync.probe.status.${check.status}`) }}
              </Badge>
            </div>

            <dl
              v-if="check.details.length"
              class="mt-2 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm"
            >
              <template v-for="detail in check.details" :key="detail.label">
                <dt class="font-mono text-muted-foreground">
                  {{ detail.label }}
                </dt>
                <dd class="break-words font-mono">
                  {{ detail.valueKey ? $t(detail.valueKey) : detail.value }}
                </dd>
              </template>
            </dl>

            <p v-if="check.error" class="mt-2 text-sm text-destructive">
              {{ check.error }}
            </p>
          </li>
        </ul>
      </CardContent>

      <CardFooter v-if="report" class="flex-col items-stretch gap-4">
        <Button variant="outline" @click="copyReport">
          <Copy class="size-4" aria-hidden="true" />
          {{ $t("providers.sendspin_sync.probe.copy") }}
        </Button>

        <Accordion type="single" collapsible>
          <AccordionItem value="raw">
            <AccordionTrigger>
              {{ $t("providers.sendspin_sync.probe.raw") }}
            </AccordionTrigger>
            <AccordionContent>
              <pre class="overflow-x-auto rounded-md bg-muted p-3 text-xs">{{
                reportJson
              }}</pre>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardFooter>
    </Card>
  </section>
</template>

<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  PROBE_CHECKS,
  summariseProbe,
  useMicrophoneProbe,
  VOICE_PROCESSING,
  type CheckStatus,
  type MicrophoneProbeReport,
  type ProbeCheckId,
} from "@/composables/sendspin-sync/useMicrophoneProbe";
import { copyToClipboard } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import { Copy, Mic, TriangleAlert } from "@lucide/vue";
import { computed } from "vue";
import { toast } from "vue-sonner";

/** Either a literal reading or a translation key for a word like "not reported". */
interface DetailValue {
  value?: string;
  valueKey?: string;
}

interface DetailRow extends DetailValue {
  /** Web Audio and DOM identifiers stay verbatim so a pasted report is greppable. */
  label: string;
}

interface CheckRow {
  id: ProbeCheckId;
  status: CheckStatus;
  titleKey: string;
  hintKey: string;
  details: DetailRow[];
  error: string | null;
}

const VALUES = "providers.sendspin_sync.probe.values";

const statusVariant: Record<CheckStatus, BadgeVariants["variant"]> = {
  pass: "default",
  warn: "warning",
  fail: "destructive",
  not_evaluated: "outline",
};

const {
  running,
  report,
  reportJson,
  captureProgress,
  captureRemainingSeconds,
  run,
} = useMicrophoneProbe();

const summary = computed(() =>
  report.value ? summariseProbe(report.value) : null,
);

const headline = computed(() =>
  summary.value
    ? `providers.sendspin_sync.probe.verdict.${summary.value.verdict}`
    : "providers.sendspin_sync.probe.idle",
);

/** Names the reason the probe could not run, so the remedy can be spelled out. */
const blocker = computed(() => {
  const current = report.value;
  if (!current || summary.value?.verdict !== "blocked") return null;
  const reason = !current.secureContext.secure
    ? "insecure"
    : !current.mediaApi.getUserMedia
      ? "no_api"
      : "refused";
  return `providers.sendspin_sync.probe.blocked.${reason}`;
});

const checks = computed<CheckRow[]>(() => {
  const current = report.value;
  const statuses = summary.value?.checks;
  if (!current || !statuses) return [];

  return PROBE_CHECKS.map((id) => ({
    id,
    status: statuses[id],
    titleKey: `providers.sendspin_sync.probe.checks.${id}.title`,
    hintKey: `providers.sendspin_sync.probe.checks.${id}.hint`,
    details: detailsFor(id, current),
    error: errorFor(id, current),
  }));
});

function detailsFor(
  id: ProbeCheckId,
  current: MicrophoneProbeReport,
): DetailRow[] {
  switch (id) {
    case "secure_context":
      return [
        { label: "origin", value: current.secureContext.origin },
        { label: "isSecureContext", ...flag(current.secureContext.secure) },
      ];
    case "media_api":
      return [
        {
          label: "navigator.mediaDevices",
          ...presence(current.mediaApi.mediaDevices),
        },
        { label: "getUserMedia", ...presence(current.mediaApi.getUserMedia) },
      ];
    case "voice_processing": {
      const constraints = current.constraints;
      if (!constraints) return [];
      return [
        ...VOICE_PROCESSING.map((name) => ({
          label: name,
          ...switchState(constraints.applied[name]),
        })),
        { label: "device", value: constraints.trackLabel || "—" },
      ];
    }
    case "audio_context":
      return current.audioContext
        ? [
            {
              label: "sampleRate",
              value: `${current.audioContext.sampleRate} Hz`,
            },
            {
              label: "baseLatency",
              ...milliseconds(current.audioContext.baseLatency),
            },
            {
              label: "outputLatency",
              ...milliseconds(current.audioContext.outputLatency),
            },
          ]
        : [];
    case "capture":
      return current.capture
        ? [
            {
              label: "duration",
              value: `${current.capture.measuredSeconds.toFixed(1)} s`,
            },
            {
              label: "framesDelivered",
              value: `${current.capture.framesDelivered}`,
            },
            {
              label: "framesExpected",
              value: `${Math.round(current.capture.expectedFrames)}`,
            },
            {
              label: "discrepancy",
              value: `${current.capture.discrepancyPpm.toFixed(1)} ppm`,
            },
            { label: "gaps", value: `${current.capture.gapCount}` },
            {
              label: "missingFrames",
              value: `${current.capture.missingFrames}`,
            },
          ]
        : [];
    case "wake_lock":
      return current.wakeLock
        ? [
            {
              label: "navigator.wakeLock",
              ...presence(current.wakeLock.supported),
            },
            { label: "screen lock", ...flag(current.wakeLock.acquired) },
          ]
        : [];
    case "context_state":
      return current.contextState
        ? [
            {
              label: "AudioContext.state",
              ...(current.contextState.stayedRunning
                ? { valueKey: `${VALUES}.stayed_running` }
                : {
                    value: current.contextState.transitions
                      .map((t) => `${t.state} @ ${t.atSeconds.toFixed(1)}s`)
                      .join(", "),
                  }),
            },
          ]
        : [];
  }
}

function errorFor(
  id: ProbeCheckId,
  current: MicrophoneProbeReport,
): string | null {
  if (id === "voice_processing") return current.constraints?.error ?? null;
  if (id === "capture") return current.capture?.error ?? null;
  if (id === "wake_lock") return current.wakeLock?.error ?? null;
  return null;
}

/** A browser capability that is either there or not. */
function presence(available: boolean): DetailValue {
  return {
    valueKey: available ? `${VALUES}.available` : `${VALUES}.unavailable`,
  };
}

function flag(value: boolean): DetailValue {
  return { valueKey: value ? `${VALUES}.yes` : `${VALUES}.no` };
}

/** Voice processing the browser may also decline to report on at all. */
function switchState(value: boolean | undefined): DetailValue {
  if (value === undefined) return { valueKey: `${VALUES}.not_reported` };
  return { valueKey: value ? `${VALUES}.on` : `${VALUES}.off` };
}

function milliseconds(seconds: number | null): DetailValue {
  if (seconds === null) return { valueKey: `${VALUES}.not_reported` };
  return { value: `${(seconds * 1000).toFixed(2)} ms` };
}

async function copyReport(): Promise<void> {
  const copied = await copyToClipboard(reportJson.value);
  if (copied) toast.success($t("providers.sendspin_sync.probe.copied"));
  else toast.error($t("providers.sendspin_sync.probe.copy_failed"));
}
</script>
