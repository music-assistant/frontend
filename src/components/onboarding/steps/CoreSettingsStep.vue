<template>
  <section class="flex flex-col gap-5">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.core_settings.description") }}
    </p>

    <!-- the addresses in use, each with what this browser found out about it -->
    <ItemGroup class="gap-2">
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
            {{ $t(`onboarding.steps.core_settings.${address.id}_address`) }}
          </ItemTitle>
          <ItemDescription>
            {{
              $t(`onboarding.steps.core_settings.${address.id}_address_hint`)
            }}
          </ItemDescription>
          <code
            v-if="address.url"
            class="text-sm break-all"
            data-testid="onboarding-address-url"
          >
            {{ address.url }}
          </code>
          <span v-else class="text-muted-foreground text-sm">
            {{ $t("onboarding.steps.core_settings.address_unknown") }}
          </span>
          <!-- players are on the same network as this browser, so an address
               it could not reach is the one thing here worth a word of advice -->
          <p
            v-if="address.check === 'unreachable'"
            class="text-muted-foreground text-xs"
            data-testid="onboarding-address-unreachable-hint"
          >
            {{ $t("onboarding.steps.core_settings.unreachable_hint") }}
          </p>
        </ItemContent>
        <ItemActions v-if="address.url">
          <Badge
            :variant="CHECK_BADGES[address.check].variant"
            :data-check="address.check"
            data-testid="onboarding-address-check"
          >
            <component
              :is="CHECK_BADGES[address.check].icon"
              :class="CHECK_BADGES[address.check].iconClass"
              aria-hidden="true"
            />
            {{ $t(`onboarding.steps.core_settings.check.${address.check}`) }}
          </Badge>
        </ItemActions>
      </Item>
    </ItemGroup>

    <p class="text-muted-foreground text-sm">
      {{
        $t("onboarding.steps.core_settings.override_hint", {
          webserver: $t("settings.core_module.webserver.name"),
          streams: $t("settings.core_module.streams.name"),
        })
      }}
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

      <div class="grid gap-3 sm:grid-cols-2">
        <Card data-testid="onboarding-remote-access">
          <CardHeader>
            <CardTitle class="flex flex-wrap items-center gap-2">
              <Cloud class="size-4 shrink-0" aria-hidden="true" />
              {{ $t("onboarding.steps.core_settings.remote.builtin.title") }}
              <Badge variant="secondary" as="span">
                {{
                  $t("onboarding.steps.core_settings.remote.builtin.easiest")
                }}
              </Badge>
            </CardTitle>
            <CardDescription>
              {{
                $t("onboarding.steps.core_settings.remote.builtin.description")
              }}
            </CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <Switch
                :id="remoteSwitchId"
                :model-value="remoteEnabled"
                :disabled="switchingRemote"
                data-testid="onboarding-remote-access-switch"
                @update:model-value="setRemoteAccess"
              />
              <Label :for="remoteSwitchId" class="cursor-pointer">
                {{ $t("onboarding.steps.core_settings.remote.builtin.switch") }}
              </Label>
            </div>
            <div
              v-if="remoteEnabled && remoteId"
              class="flex flex-col gap-1"
              data-testid="onboarding-remote-access-id"
            >
              <span class="text-muted-foreground text-xs">
                {{ $t("onboarding.steps.core_settings.remote.builtin.id") }}
              </span>
              <div class="flex items-center gap-1">
                <code class="text-sm break-all">{{ remoteId }}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 shrink-0"
                  :aria-label="
                    $t('onboarding.steps.core_settings.remote.builtin.copy')
                  "
                  :title="
                    $t('onboarding.steps.core_settings.remote.builtin.copy')
                  "
                  data-testid="onboarding-remote-access-copy"
                  @click="copyRemoteId"
                >
                  <Copy class="size-4" />
                </Button>
              </div>
              <p class="text-muted-foreground text-xs">
                {{
                  $t("onboarding.steps.core_settings.remote.builtin.hint", {
                    remote_access: $t("settings.remote_access"),
                  })
                }}
              </p>
            </div>
          </CardContent>
        </Card>

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
          <CardContent>
            <Button
              variant="secondary"
              data-testid="onboarding-set-external-address"
              @click="openAdvanced"
            >
              {{
                $t("onboarding.steps.core_settings.remote.proxy.set_external")
              }}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>

    <div ref="advancedSection" class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Switch
          :id="advancedSwitchId"
          v-model="showAdvanced"
          data-testid="onboarding-advanced-settings"
        />
        <Label :for="advancedSwitchId" class="cursor-pointer">
          {{ $t("settings.show_advanced_settings") }}
        </Label>
      </div>

      <!-- the form stays mounted while it is folded away, so what was typed
           under Advanced survives folding it, and the wizard's Next saves
           through it either way. Every entry it holds is shown outright: the
           switch above is what hides them, not the form's own. -->
      <div
        v-show="showAdvanced"
        class="min-h-24"
        data-testid="onboarding-advanced-section"
      >
        <EditConfig
          v-if="entries.length > 0"
          ref="editConfig"
          :config-entries="entries"
          :disabled="false"
          :show-advanced-settings="true"
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
    </div>
  </section>
</template>

<script setup lang="ts">
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
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { splitCode } from "@/helpers/segmented_code";
import {
  probeServerAddress,
  type AddressCheck,
} from "@/helpers/server_address";
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type {
  ConfigValueType,
  CoreConfig,
  RemoteAccessInfo,
  StreamServerInfo,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import EditConfig from "@/views/settings/EditConfig.vue";
import {
  AudioLines,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Cloud,
  Copy,
  Globe,
  LoaderCircle,
  Waypoints,
} from "@lucide/vue";
import {
  computed,
  markRaw,
  nextTick,
  ref,
  useId,
  watch,
  type Component,
  type Ref,
} from "vue";
import { toast } from "vue-sonner";

/**
 * The core modules the advanced form edits, with the settings of each it
 * offers. The form groups its entries by category, so this is the order they
 * are handed over in rather than the order on screen.
 */
const ADVANCED_SETTINGS = {
  // the server's own name and the two addresses it advertises
  webserver: ["server_name", "base_url", "external_url"],
  // the address players fetch audio from
  streams: ["publish_ip"],
} as const;
type CoreDomain = keyof typeof ADVANCED_SETTINGS;
const DOMAINS = Object.keys(ADVANCED_SETTINGS) as CoreDomain[];

// the remote access id in groups, the way the remote access settings show it
const REMOTE_ID_GROUPS = [8, 5, 5, 8];

/** How each outcome of checking an address is shown. */
const CHECK_BADGES: Record<
  AddressCheck,
  { variant: BadgeVariants["variant"]; icon: Component; iconClass?: string }
> = {
  checking: {
    variant: "outline",
    icon: markRaw(LoaderCircle),
    iconClass: "animate-spin",
  },
  reachable: { variant: "default", icon: markRaw(CircleCheck) },
  unreachable: { variant: "destructive", icon: markRaw(CircleAlert) },
  unchecked: { variant: "outline", icon: markRaw(CircleHelp) },
};

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const advancedSwitchId = useId();
const remoteSwitchId = useId();

// The internal address as the server advertises it right now, which server
// info reports; the stream server's is asked for, as nothing else carries it.
const internalUrl = computed(
  () =>
    api.serverInfo.value?.internal_url ||
    api.serverInfo.value?.base_url ||
    undefined,
);
const streamInfo = ref<StreamServerInfo>();
const streamUrl = computed(() => streamInfo.value?.base_url);

/**
 * What this browser finds out about an address, kept current: every change of
 * the address is checked afresh, and an answer about an address that has
 * changed since is dropped.
 */
const checkedFromHere = function (
  url: Ref<string | undefined>,
): Ref<AddressCheck> {
  const check = ref<AddressCheck>("checking");
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

const internalCheck = checkedFromHere(internalUrl);
const streamCheck = checkedFromHere(streamUrl);

const addresses = computed(() => [
  {
    id: "internal",
    icon: markRaw(Globe),
    url: internalUrl.value,
    check: internalCheck.value,
  },
  {
    id: "stream",
    icon: markRaw(AudioLines),
    url: streamUrl.value,
    check: streamCheck.value,
  },
]);

const remoteAccess = ref<RemoteAccessInfo>();
const switchingRemote = ref(false);
// what the last answer about remote access said, else what server info says
const remoteEnabled = computed(
  () =>
    remoteAccess.value?.enabled ??
    api.serverInfo.value?.has_remote_access ??
    false,
);
const remoteId = computed(() => {
  const id = remoteAccess.value?.remote_id;
  return id ? splitCode(id, REMOTE_ID_GROUPS).join("-") : undefined;
});

const showAdvanced = ref(false);
const advancedSection = ref<HTMLElement | null>(null);
const configs = ref<Partial<Record<CoreDomain, CoreConfig>>>({});
// whether the settings have been asked for and answered, however that turned
// out: until then the section reserves the room rather than claiming anything
const loaded = ref(false);
const editConfig = ref<InstanceType<typeof EditConfig>>();

// Only the settings the form is about, and only the ones the server knows: an
// older or newer server that does not carry one of them leaves it out rather
// than having the form make one up.
const entries = computed<ConfigEntryUI[]>(() =>
  DOMAINS.flatMap((domain) =>
    ADVANCED_SETTINGS[domain].map((key) => configs.value[domain]?.values[key]),
  ).filter((entry) => entry != null),
);

// the save in flight, so the form's own Save button and the wizard's Next share
// one path: whichever started it, both wait on the same answer and neither
// sends the same settings a second time
let pendingSave: Promise<boolean> | undefined;

const loadStreamServerInfo = async function (): Promise<void> {
  try {
    streamInfo.value = await api.getStreamServerInfo();
  } catch (error) {
    // the api already told the user; the row then says the address is not
    // available rather than showing one nobody stands behind
    streamInfo.value = undefined;
    console.warn("Failed to load the stream server address:", error);
  }
};

const loadRemoteAccess = async function (): Promise<void> {
  try {
    remoteAccess.value = await api.getRemoteAccessInfo();
  } catch (error) {
    // the api already told the user; the switch still follows server info
    console.warn("Failed to load the remote access details:", error);
  }
};

const setRemoteAccess = async function (enabled: boolean): Promise<void> {
  if (switchingRemote.value) return;
  switchingRemote.value = true;
  try {
    remoteAccess.value = await api.configureRemoteAccess(enabled);
    toast.success(
      $t(
        enabled
          ? "settings.remote_access_enabled_success"
          : "settings.remote_access_disabled_success",
      ),
    );
  } catch (error) {
    // the api already told the user; the switch stays where the server left it
    console.warn("Failed to switch remote access:", error);
  } finally {
    switchingRemote.value = false;
  }
};

const copyRemoteId = async function (): Promise<void> {
  if (!remoteId.value) return;
  if (await copyToClipboard(remoteId.value)) {
    toast.success($t("settings.remote_access_id_copied"));
  } else {
    toast.error($t("settings.remote_access_error_copy"));
  }
};

/** Unfold the advanced settings and bring them into view. */
const openAdvanced = async function (): Promise<void> {
  showAdvanced.value = true;
  await nextTick();
  advancedSection.value?.scrollIntoView?.({
    block: "nearest",
    behavior: "smooth",
  });
};

/** The settings of one module out of everything the form hands over. */
const valuesOf = function (
  domain: CoreDomain,
  values: Record<string, ConfigValueType>,
): Record<string, ConfigValueType> {
  const keys: readonly string[] = ADVANCED_SETTINGS[domain];
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => keys.includes(key)),
  );
};

const onSubmit = function (values: Record<string, ConfigValueType>) {
  // each module is handed its own settings and merges them into what it has
  // stored, so the settings this form leaves out keep the values they had
  const save = Promise.all(
    DOMAINS.map(async (domain) => {
      const own = valuesOf(domain, values);
      if (Object.keys(own).length === 0) return;
      await api.saveCoreConfig(domain, own);
      // the stream server comes back on its new address before the save
      // answers, so its row is asked again; the internal address follows
      // server info by itself
      if (domain === "streams") await loadStreamServerInfo();
    }),
  )
    .then(() => {
      // the form stays on screen here, so it is told which values are stored
      // now: otherwise it keeps offering to save what it already saved
      editConfig.value?.saveSucceeded(values);
      toast.success($t("settings.settings_saved"));
      return true;
    })
    .catch(() => {
      // the api tells the user what went wrong itself; the form takes its
      // pending edits back under guard, so nothing typed here is lost
      editConfig.value?.saveFailed();
      return false;
    })
    .finally(() => {
      if (pendingSave === save) pendingSave = undefined;
    });
  pendingSave = save;
};

const loadConfigs = async function (): Promise<void> {
  try {
    const [webserver, streams] = await Promise.all([
      api.getCoreConfig("webserver"),
      api.getCoreConfig("streams"),
    ]);
    configs.value = { webserver, streams };
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
void loadStreamServerInfo();
// the id is only worth asking for once remote access is on
if (api.serverInfo.value?.has_remote_access) void loadRemoteAccess();

/**
 * The wizard asking whether it may move on. Anything the user typed is saved
 * first — the form validates it and shows what it will not accept — and a save
 * that did not land keeps the wizard here rather than leaving the edit behind.
 */
const beforeLeave = async function (): Promise<boolean> {
  await loading;
  // the Save button got there first: its answer is this one too
  if (pendingSave) return await pendingSave;
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
