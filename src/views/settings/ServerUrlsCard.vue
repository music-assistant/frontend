<template>
  <Card class="mb-4" data-testid="server-urls">
    <CardHeader>
      <CardTitle>{{ $t("settings.server_url.title") }}</CardTitle>
      <CardDescription>
        {{ $t("settings.server_url.description") }}
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-6">
      <FieldSet class="gap-3" data-testid="server-urls-internet">
        <!-- styled like the section headings of the settings form below -->
        <FieldLegend
          class="mb-2 flex w-full items-center gap-3 text-xs tracking-wider text-primary uppercase"
        >
          <span>{{ $t("settings.server_url.internet") }}</span>
          <span class="h-px flex-1 bg-border"></span>
        </FieldLegend>
        <Field v-if="offersRemoteAccess" orientation="horizontal">
          <Switch
            :id="`${formId}-remote`"
            :model-value="useRemoteAccess"
            data-testid="server-urls-remote-switch"
            @update:model-value="setUseRemoteAccess"
          />
          <FieldLabel :for="`${formId}-remote`">
            {{ $t("settings.server_url.use_remote_access") }}
          </FieldLabel>
        </Field>
        <Field v-if="useRemoteAccess" data-testid="server-urls-remote-link">
          <div
            v-if="remoteUrl || loadingRemoteId"
            class="flex min-h-7 items-center gap-1"
          >
            <!-- the room is kept while the link is on its way -->
            <Skeleton v-if="!remoteUrl" class="h-5 w-80 max-w-full" />
            <template v-else>
              <code class="text-sm break-all">{{ remoteUrl }}</code>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 shrink-0"
                :aria-label="$t('settings.server_url.copy_remote')"
                :title="$t('settings.server_url.copy_remote')"
                data-testid="server-urls-remote-copy"
                @click="copyUrl(remoteUrl)"
              >
                <Copy class="size-4" />
              </Button>
            </template>
          </div>
          <FieldDescription>
            {{ $t("settings.server_url.remote_access_description") }}
          </FieldDescription>
        </Field>
        <Field v-else>
          <FieldLabel :for="`${formId}-external`">
            {{ externalUrl.label }}
          </FieldLabel>
          <Input
            :id="`${formId}-external`"
            :model-value="externalUrlValue"
            type="url"
            placeholder="https://"
            autocomplete="off"
            data-testid="server-urls-external-input"
            @update:model-value="
              emit('update:value', externalUrl.key, String($event))
            "
          />
          <FieldDescription class="whitespace-pre-line">
            {{ externalUrl.description }}
          </FieldDescription>
          <FieldDescription
            v-if="!hasRemoteAccess"
            data-testid="server-urls-remote-hint"
          >
            {{ $t("settings.server_url.remote_access_hint") }}
            <RouterLink
              v-if="canManageSystem"
              :to="{ name: 'remoteaccesssettings' }"
              class="text-primary"
            >
              {{ $t("settings.server_url.set_up_remote_access") }}
            </RouterLink>
          </FieldDescription>
        </Field>
      </FieldSet>

      <FieldSet class="gap-3" data-testid="server-urls-local">
        <FieldLegend
          class="mb-2 flex w-full items-center gap-3 text-xs tracking-wider text-primary uppercase"
        >
          <span>{{ $t("settings.server_url.local_network") }}</span>
          <span class="h-px flex-1 bg-border"></span>
        </FieldLegend>
        <Field orientation="horizontal">
          <Switch
            :id="`${formId}-automatic`"
            :model-value="automatic"
            data-testid="server-urls-automatic-switch"
            @update:model-value="setAutomatic"
          />
          <FieldLabel :for="`${formId}-automatic`">
            {{ $t("settings.server_url.automatic") }}
          </FieldLabel>
        </Field>
        <div
          v-if="automatic"
          class="flex min-h-7 items-center gap-1"
          data-testid="server-urls-detected"
        >
          <template v-if="detectedUrl">
            <code class="text-sm break-all">{{ detectedUrl }}</code>
            <Button
              variant="ghost"
              size="icon"
              class="size-7 shrink-0"
              :aria-label="$t('settings.server_url.copy_detected')"
              :title="$t('settings.server_url.copy_detected')"
              data-testid="server-urls-detected-copy"
              @click="copyUrl(detectedUrl)"
            >
              <Copy class="size-4" />
            </Button>
          </template>
          <span v-else class="text-muted-foreground text-sm">
            {{ $t("settings.server_url.detected_after_save") }}
          </span>
        </div>
        <Field v-else>
          <FieldLabel :for="`${formId}-internal`">
            {{ baseUrl.label }}
          </FieldLabel>
          <Input
            :id="`${formId}-internal`"
            :model-value="baseUrlValue"
            type="url"
            placeholder="http://"
            autocomplete="off"
            data-testid="server-urls-internal-input"
            @update:model-value="
              emit('update:value', baseUrl.key, String($event))
            "
          />
          <FieldDescription class="whitespace-pre-line">
            {{ baseUrl.description }}
          </FieldDescription>
        </Field>
      </FieldSet>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { Scope, type ConfigEntry } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Copy } from "@lucide/vue";
import { computed, ref, useId } from "vue";
import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";

/**
 * The URLs Music Assistant is reached at, from the internet and on the local
 * network. Edits are reported with `update:value` for the host form to apply
 * and save.
 */

const AUTO = "auto";

const props = defineProps<{
  // the webserver's `base_url` entry
  baseUrl: ConfigEntry;
  // the webserver's `external_url` entry
  externalUrl: ConfigEntry;
}>();

const emit = defineEmits<{
  (e: "update:value", key: string, value: string): void;
}>();

const formId = useId();
const canManageSystem = authManager.hasScope(Scope.SYSTEM_MANAGE);
const remoteId = ref<string>();
const loadingRemoteId = ref(false);
// the server reads an empty internal URL as auto
const isAutomatic = (value: unknown) => !value || value === AUTO;
// the URL the server reports is only the detected one while the stored value is auto
const storedAutomatic = isAutomatic(props.baseUrl.value);
// the inputs are in use, so emptying one to type another URL keeps it open
const enteringExternalUrl = ref(!!props.externalUrl.value);
const enteringBaseUrl = ref(!storedAutomatic);
// what the inputs held before their switch took over, given back when it is
// switched off again
let typedExternalUrl = "";
let typedBaseUrl = "";

const hasRemoteAccess = computed(
  () => !!api.serverInfo.value?.has_remote_access,
);
// the remote access link can only be read with the system scope
const offersRemoteAccess = computed(
  () => hasRemoteAccess.value && canManageSystem,
);
const externalUrlValue = computed(() => String(props.externalUrl.value ?? ""));
// the server prefers a set external URL over remote access, so an empty one
// is what lets remote access be used
const useRemoteAccess = computed(
  () =>
    offersRemoteAccess.value &&
    !externalUrlValue.value &&
    !enteringExternalUrl.value,
);
const remoteUrl = computed(() =>
  remoteId.value
    ? `https://app.music-assistant.io/?remote_id=${remoteId.value}`
    : undefined,
);
const baseUrlValue = computed(() => String(props.baseUrl.value ?? ""));
const automatic = computed(
  () => isAutomatic(baseUrlValue.value) && !enteringBaseUrl.value,
);
const detectedUrl = computed(() =>
  storedAutomatic ? api.serverInfo.value?.internal_url || undefined : undefined,
);

const setUseRemoteAccess = function (value: boolean) {
  enteringExternalUrl.value = !value;
  if (value) {
    typedExternalUrl = externalUrlValue.value;
    if (typedExternalUrl) emit("update:value", props.externalUrl.key, "");
  } else if (typedExternalUrl) {
    emit("update:value", props.externalUrl.key, typedExternalUrl);
  }
};

const setAutomatic = function (value: boolean) {
  enteringBaseUrl.value = !value;
  if (value) {
    typedBaseUrl = baseUrlValue.value;
    emit("update:value", props.baseUrl.key, AUTO);
  } else {
    emit(
      "update:value",
      props.baseUrl.key,
      typedBaseUrl || detectedUrl.value || "",
    );
  }
};

const copyUrl = async function (url: string) {
  if (await copyToClipboard(url)) {
    toast.success($t("settings.server_url.copied"));
  } else {
    toast.error($t("settings.server_url.copy_failed"));
  }
};

/**
 * Forget the choices made with the switches here, for when both URLs are set
 * back to their defaults.
 */
const reset = function () {
  enteringExternalUrl.value = false;
  enteringBaseUrl.value = false;
  typedExternalUrl = "";
  typedBaseUrl = "";
};

defineExpose({ reset });

const loadRemoteId = async function () {
  loadingRemoteId.value = true;
  try {
    remoteId.value = (await api.getRemoteAccessInfo()).remote_id || undefined;
  } catch (error) {
    // the api already told the user; the link just stays out
    console.warn("Failed to load the remote access details:", error);
  } finally {
    loadingRemoteId.value = false;
  }
};

if (offersRemoteAccess.value) void loadRemoteId();
</script>
