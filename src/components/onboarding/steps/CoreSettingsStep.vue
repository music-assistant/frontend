<template>
  <section class="flex flex-col gap-5">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.core_settings.intro") }}
    </p>

    <div class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h3 class="text-sm font-semibold">
          {{ $t("onboarding.steps.core_settings.remote.title") }}
        </h3>
        <p class="text-muted-foreground text-sm">
          {{ $t("onboarding.steps.core_settings.remote.description") }}
        </p>
      </div>

      <div class="grid items-start gap-3 sm:grid-cols-2">
        <RemoteAccessCard v-if="canManageRemoteAccess" />

        <Card data-testid="onboarding-reverse-proxy">
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Waypoints class="size-4 shrink-0" aria-hidden="true" />
              {{ $t("onboarding.steps.core_settings.remote.proxy.title") }}
            </CardTitle>
            <CardDescription>
              {{
                $t("onboarding.steps.core_settings.remote.proxy.description")
              }}
            </CardDescription>
          </CardHeader>
          <CardContent v-if="canEditSettings">
            <Button
              variant="secondary"
              data-testid="onboarding-set-external-address"
              @click="openEditing"
            >
              {{
                $t("onboarding.steps.core_settings.remote.proxy.set_external")
              }}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- players are on the same network as this browser, so an address it
         could not reach is the one thing here worth a word of advice -->
    <p
      v-if="anyUnreachable"
      class="text-destructive text-sm"
      role="status"
      data-testid="onboarding-address-unreachable-hint"
    >
      {{ $t("onboarding.steps.core_settings.unreachable_hint") }}
    </p>

    <!-- folded content stays mounted, so what was typed in the form survives
         folding it, and the wizard's Next saves through it either way -->
    <Accordion
      v-model="networkDetails"
      type="single"
      collapsible
      :unmount-on-hide="false"
      data-testid="onboarding-network-details"
    >
      <AccordionItem :value="NETWORK_DETAILS_PANEL" class="border-b-0">
        <AccordionTrigger>
          {{ $t("onboarding.steps.core_settings.network_details") }}
        </AccordionTrigger>
        <AccordionContent class="space-y-3">
          <ItemGroup class="gap-2">
            <Item
              variant="outline"
              size="sm"
              data-testid="onboarding-server-name"
            >
              <ItemMedia variant="icon">
                <Server aria-hidden="true" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{{ $t("settings.server_name") }}</ItemTitle>
                <span class="text-sm break-all">
                  {{
                    serverName ??
                    $t("onboarding.steps.core_settings.address_unknown")
                  }}
                </span>
              </ItemContent>
            </Item>

            <!-- the addresses in use, each with what this browser found out about it -->
            <Item
              v-for="address in addresses"
              :key="address.id"
              variant="outline"
              size="sm"
              :data-testid="`onboarding-address-${address.id}`"
            >
              <ItemMedia variant="icon">
                <component :is="address.icon" aria-hidden="true" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {{
                    $t(`onboarding.steps.core_settings.${address.id}_address`)
                  }}
                </ItemTitle>
                <ItemDescription>
                  {{
                    $t(
                      `onboarding.steps.core_settings.${address.id}_address_hint`,
                    )
                  }}
                </ItemDescription>
                <code
                  v-if="address.url"
                  class="text-sm break-all"
                  data-testid="onboarding-address-url"
                >
                  {{ address.url }}
                </code>
                <!-- an address still being asked for is not one that is missing -->
                <span
                  v-else-if="!address.pending"
                  class="text-muted-foreground text-sm"
                  data-testid="onboarding-address-unknown"
                >
                  {{ $t("onboarding.steps.core_settings.address_unknown") }}
                </span>
              </ItemContent>
              <ItemActions v-if="address.url && address.check">
                <Badge
                  :variant="CHECK_BADGES[address.check].variant"
                  :class="CHECK_BADGES[address.check].class"
                  :data-check="address.check"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  data-testid="onboarding-address-check"
                >
                  <component
                    :is="CHECK_BADGES[address.check].icon"
                    :class="CHECK_BADGES[address.check].iconClass"
                    aria-hidden="true"
                  />
                  {{
                    $t(`onboarding.steps.core_settings.check.${address.check}`)
                  }}
                </Badge>
              </ItemActions>
            </Item>
          </ItemGroup>

          <div class="flex items-start justify-between gap-3">
            <p class="text-muted-foreground text-sm">
              {{
                $t("onboarding.steps.core_settings.override_hint", {
                  system: $t("settings.system"),
                  webserver: $t("settings.core_module.webserver.name"),
                  streams: $t("settings.core_module.streams.name"),
                })
              }}
            </p>
            <Button
              v-if="canEditSettings"
              variant="outline"
              size="sm"
              :aria-expanded="editing"
              :aria-controls="editFormId"
              data-testid="onboarding-network-edit"
              @click="toggleEditing"
            >
              <Pencil aria-hidden="true" />
              {{ $t("edit") }}
            </Button>
          </div>

          <!-- every entry the form holds is shown outright: whether the form
               is open at all is what hides them, not the form's own toggle -->
          <div
            v-if="canEditSettings"
            v-show="editing"
            :id="editFormId"
            ref="editSection"
            class="min-h-24"
            data-testid="onboarding-network-edit-form"
          >
            <EditConfig
              v-if="entries.length > 0"
              ref="editConfig"
              :config-entries="entries"
              :disabled="false"
              :show-advanced-settings="true"
              :inline-save="true"
              :hide-header="true"
              @submit="onSubmit"
            />

            <div
              v-else-if="!loaded"
              class="flex min-h-24 items-center justify-center"
            >
              <Spinner class="size-6" />
            </div>

            <Empty
              v-else
              class="border-border rounded-md border border-dashed py-6"
            >
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Globe />
                </EmptyMedia>
                <EmptyTitle>
                  {{ $t("onboarding.steps.core_settings.load_failed") }}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </section>
</template>

<script setup lang="ts">
import RemoteAccessCard from "@/components/onboarding/RemoteAccessCard.vue";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge, type BadgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { OnboardingStepId } from "@/helpers/onboarding";
import {
  probeServerAddress,
  type AddressCheck,
} from "@/helpers/server_address";
import { api } from "@/plugins/api";
import {
  Scope,
  type ConfigValueType,
  type CoreConfig,
  type StreamServerInfo,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";
import {
  AudioLines,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Globe,
  LoaderCircle,
  Pencil,
  Server,
  Waypoints,
} from "@lucide/vue";
import {
  computed,
  markRaw,
  nextTick,
  onBeforeUnmount,
  ref,
  useId,
  watch,
  type Component,
  type Ref,
} from "vue";
import { toast } from "vue-sonner";

/**
 * The core modules the form edits, with the settings of each it offers. The
 * form groups its entries by category, so this is the order they are handed
 * over in rather than the order on screen.
 */
const NETWORK_SETTINGS = {
  // the server's own name and the two addresses it advertises
  webserver: ["server_name", "base_url", "external_url"],
  // the address players fetch audio from
  streams: ["publish_ip"],
} as const;
type CoreDomain = keyof typeof NETWORK_SETTINGS;
const DOMAINS = Object.keys(NETWORK_SETTINGS) as CoreDomain[];

// The stream server only restarts on its new address a moment after a save
// has answered, and says nothing once it is up again, so the address is asked
// for again a few times until it has moved.
const STREAM_REFRESH_DELAYS_MS = [1500, 3000, 5000];
const NETWORK_DETAILS_PANEL = "network-details";

/** What an address row shows about its check: the outcome, or that it is under way. */
type CheckState = AddressCheck | "checking";

/** How each state of an address check is shown. */
const CHECK_BADGES: Record<
  CheckState,
  {
    variant: BadgeVariants["variant"];
    class?: string;
    icon: Component;
    iconClass?: string;
  }
> = {
  checking: {
    variant: "outline",
    icon: markRaw(LoaderCircle),
    iconClass: "animate-spin",
  },
  reachable: {
    variant: "default",
    class: "bg-primary/10 text-primary",
    icon: markRaw(CircleCheck),
  },
  unreachable: {
    variant: "default",
    class: "bg-destructive/10 text-destructive",
    icon: markRaw(CircleAlert),
  },
  unchecked: { variant: "outline", icon: markRaw(CircleHelp) },
};

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

// what this admin may do here: a custom role can run the setup without being
// allowed to switch remote access, or to read or change the server's settings
const canManageRemoteAccess = authManager.hasScope(Scope.SYSTEM_MANAGE);
const canReadSettings = authManager.hasScope(Scope.CONFIG_CORE_READ);
const canEditSettings = authManager.hasScope(Scope.CONFIG_CORE_WRITE);

const editFormId = useId();

const serverName = computed(() => api.serverInfo.value?.name);
// The internal address as the server advertises it right now, which server
// info reports; the stream server's is asked for, as nothing else carries it.
const internalUrl = computed(
  () => api.serverInfo.value?.internal_url || undefined,
);
const streamInfo = ref<StreamServerInfo>();
// whether the stream server has answered, however that turned out: until then
// the row shows no address rather than claiming there is none
const streamAnswered = ref(false);
const streamUrl = computed(() => streamInfo.value?.base_url);
// which request the latest answer belongs to, so a slow first answer cannot
// overwrite the address the server has moved to since
let streamRequest = 0;
// whether the step is gone: a refresh under way then has nothing to update
let unmounted = false;

/**
 * What this browser finds out about an address, kept current: every change of
 * the address is checked afresh, and an answer about an address that has
 * changed since is dropped.
 */
const checkedFromHere = function (
  url: Ref<string | undefined>,
): Ref<CheckState> {
  const check = ref<CheckState>("checking");
  watch(
    url,
    async (current) => {
      if (!current) return;
      check.value = "checking";
      const result = await probeServerAddress(
        current,
        api.serverInfo.value?.server_id ?? "",
      );
      if (url.value === current) check.value = result;
    },
    { immediate: true },
  );
  return check;
};

const externalUrl = computed(
  () => api.serverInfo.value?.external_url || undefined,
);

const internalCheck = checkedFromHere(internalUrl);
const streamCheck = checkedFromHere(streamUrl);

/** An address row; one without a check shows no badge. */
interface AddressRow {
  id: "internal" | "external" | "stream";
  icon: Component;
  url: string | undefined;
  pending: boolean;
  check?: CheckState;
}

const addresses = computed<AddressRow[]>(() => [
  {
    id: "internal",
    icon: markRaw(Globe),
    url: internalUrl.value,
    pending: false,
    check: internalCheck.value,
  },
  // only set behind a reverse proxy, and not checked: players never use it
  ...(externalUrl.value
    ? [
        {
          id: "external" as const,
          icon: markRaw(Waypoints),
          url: externalUrl.value,
          pending: false,
        },
      ]
    : []),
  {
    id: "stream",
    icon: markRaw(AudioLines),
    url: streamUrl.value,
    pending: !streamAnswered.value,
    check: streamCheck.value,
  },
]);
const anyUnreachable = computed(() =>
  addresses.value.some((address) => address.check === "unreachable"),
);
const networkDetails = ref<string>();
// opened for an unreachable address, but never folded away from under the
// user: a saved address is checked afresh, and the form may be open
watch(
  anyUnreachable,
  (unreachable) => {
    if (unreachable) networkDetails.value = NETWORK_DETAILS_PANEL;
  },
  { immediate: true },
);

const editing = ref(false);
const editSection = ref<HTMLElement | null>(null);
const configs = ref<Partial<Record<CoreDomain, CoreConfig>>>({});
// whether the settings have been asked for and answered, however that turned
// out: until then the section reserves the room rather than claiming anything
const loaded = ref(false);
const editConfig = ref<InstanceType<typeof EditConfig>>();

// Only the settings the form is about, and only the ones the server knows: a
// newer server that does not carry one of them leaves it out rather than having
// the form make one up.
const entries = computed<ConfigEntryUI[]>(() =>
  DOMAINS.flatMap((domain) =>
    NETWORK_SETTINGS[domain].map((key) => configs.value[domain]?.values[key]),
  ).filter((entry) => entry != null),
);

// the save in flight, so the form's own Save button and the wizard's Next share
// one path: whichever started it, both wait on the same answer and neither
// sends the same settings a second time
let pendingSave: Promise<boolean> | undefined;
// the settings as the server has them, so a save only carries what changed:
// the form hands every entry over, and the entries themselves change as the
// user types, so neither says what the server was last told
let saved: Record<string, ConfigValueType> = {};

const loadStreamServerInfo = async function (): Promise<void> {
  const current = ++streamRequest;
  try {
    // best effort: the row says the address is not available rather than the
    // app raising an error over it, and a lookup that fails later on keeps
    // the last address known rather than taking it away
    const answer = await api.getStreamServerInfo({ suppressGlobalError: true });
    if (current === streamRequest) streamInfo.value = answer;
  } catch (error) {
    console.warn("Failed to load the stream server address:", error);
  } finally {
    // only the latest request says whether the server has answered
    if (current === streamRequest) streamAnswered.value = true;
  }
};

const refreshStreamServerInfo = async function (): Promise<void> {
  const previous = streamInfo.value?.base_url;
  for (const delay of STREAM_REFRESH_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (unmounted) return;
    await loadStreamServerInfo();
    // a lookup that failed while the server was restarting says nothing yet
    const moved = streamInfo.value?.base_url;
    if (moved && moved !== previous) return;
  }
};

/** Unfold the network details with the form open, and bring it into view. */
const openEditing = async function (): Promise<void> {
  networkDetails.value = NETWORK_DETAILS_PANEL;
  editing.value = true;
  await nextTick();
  editSection.value?.scrollIntoView?.({
    block: "nearest",
    behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });
};

const toggleEditing = function (): void {
  if (editing.value) editing.value = false;
  else void openEditing();
};

/** The settings of one module the server carries that differ from what it has. */
const changedValuesOf = function (
  domain: CoreDomain,
  values: Record<string, ConfigValueType>,
): Record<string, ConfigValueType> {
  const keys: readonly string[] = NETWORK_SETTINGS[domain];
  return Object.fromEntries(
    Object.entries(values).filter(
      ([key, value]) =>
        keys.includes(key) && key in saved && value !== saved[key],
    ),
  );
};

/**
 * Hand each module the settings of its own that changed; it merges them into
 * what it has stored, so everything else keeps its value. Over only once every
 * module has answered, so nothing can overlap a request still on its way.
 */
const saveChanges = async function (
  values: Record<string, ConfigValueType>,
): Promise<boolean> {
  const outcomes = await Promise.allSettled(
    DOMAINS.map(async (domain) => {
      const own = changedValuesOf(domain, values);
      if (Object.keys(own).length === 0) return;
      await api.saveCoreConfig(domain, own);
      saved = { ...saved, ...own };
      // the internal address follows server info by itself; the stream
      // server's has to be asked for once it is back on its new address
      if (domain === "streams") void refreshStreamServerInfo();
    }),
  );
  return outcomes.every((outcome) => outcome.status === "fulfilled");
};

const onSubmit = function (values: Record<string, ConfigValueType>) {
  // one save at a time: the form's button stays live while a save is out,
  // and a second one sent behind the first is what the server ends up with
  const save = (pendingSave ?? Promise.resolve(true))
    .then(() => saveChanges(values))
    .then((succeeded) => {
      if (!succeeded) {
        // the api tells the user what went wrong itself; the form takes its
        // pending edits back under guard, so nothing typed here is lost
        editConfig.value?.saveFailed();
        return false;
      }
      // the form stays on screen here, so it is told which values are stored
      // now: otherwise it keeps offering to save what it already saved
      editConfig.value?.saveSucceeded(values);
      toast.success($t("settings.settings_saved"));
      return true;
    })
    .finally(() => {
      if (pendingSave === save) pendingSave = undefined;
    });
  pendingSave = save;
};

const loadConfigs = async function (): Promise<void> {
  if (!canEditSettings) return;
  try {
    const [webserver, streams] = await Promise.all([
      api.getCoreConfig("webserver"),
      api.getCoreConfig("streams"),
    ]);
    configs.value = { webserver, streams };
    // the form fills an entry without a value in with its default, and hands
    // one without either over as null
    saved = Object.fromEntries(
      entries.value.map((entry) => [
        entry.key,
        entry.value ?? entry.default_value ?? null,
      ]),
    );
  } catch (error) {
    // the api already told the user; the section then says so rather than
    // showing a form filled in with values nobody stands behind
    console.warn("Failed to load the server settings:", error);
  } finally {
    loaded.value = true;
  }
};

// the load in flight: the wizard waits for it before it moves on, so a Next
// that lands while the settings are still coming in does not walk past them
const loading = loadConfigs();
if (canReadSettings) void loadStreamServerInfo();
else streamAnswered.value = true;

onBeforeUnmount(() => {
  unmounted = true;
});

/**
 * The wizard asking whether it may move on. Anything the user typed is saved
 * first — the form validates it and shows what it will not accept — and a save
 * that did not land keeps the wizard here rather than leaving the edit behind.
 */
const beforeLeave = async function (): Promise<boolean> {
  await loading;
  // the Save button got there first: a save that did not land is the answer,
  // one that did still leaves whatever was typed since to be saved below
  if (pendingSave && !(await pendingSave)) return false;
  const form = editConfig.value;
  if (!form?.hasUnsavedChanges) return true;
  await form.submit();
  // nothing under way afterwards means the form held its values back and is
  // showing what is wrong with them — unless the save was already through, in
  // which case it has taken the edits over and there is nothing left to keep
  return pendingSave ? await pendingSave : !form.hasUnsavedChanges;
};

defineExpose({ beforeLeave });
</script>
