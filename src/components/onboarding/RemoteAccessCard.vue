<template>
  <Card data-testid="onboarding-remote-access">
    <CardHeader>
      <CardTitle class="flex items-center gap-2">
        <Cloud class="size-4 shrink-0" aria-hidden="true" />
        {{ $t("onboarding.steps.core_settings.remote.builtin.title") }}
      </CardTitle>
      <CardDescription>
        {{ $t("onboarding.steps.core_settings.remote.builtin.description") }}
      </CardDescription>
      <CardAction>
        <Badge variant="secondary">
          {{ $t("onboarding.steps.core_settings.remote.builtin.easiest") }}
        </Badge>
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <Switch
          :id="switchId"
          :model-value="enabled"
          :disabled="busy"
          data-testid="onboarding-remote-access-switch"
          @update:model-value="setEnabled"
        />
        <Label :for="switchId" class="cursor-pointer">
          {{ $t("onboarding.steps.core_settings.remote.builtin.switch") }}
        </Label>
      </div>
      <div
        v-if="enabled && (remoteId || loadingId)"
        class="flex flex-col gap-1"
        data-testid="onboarding-remote-access-id"
      >
        <span class="text-muted-foreground text-xs">
          {{ $t("onboarding.steps.core_settings.remote.builtin.id") }}
        </span>
        <div class="flex min-h-7 items-center gap-1">
          <!-- the room is kept while the id is on its way, so the step does
               not shift once it lands -->
          <Skeleton
            v-if="!remoteId"
            class="h-5 w-64 max-w-full"
            data-testid="onboarding-remote-access-id-loading"
          />
          <code v-else class="text-sm break-all">{{ remoteId }}</code>
          <Button
            v-if="remoteId"
            variant="ghost"
            size="icon"
            class="size-7 shrink-0"
            :aria-label="
              $t('onboarding.steps.core_settings.remote.builtin.copy')
            "
            :title="$t('onboarding.steps.core_settings.remote.builtin.copy')"
            data-testid="onboarding-remote-access-copy"
            @click="copyId"
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
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatRemoteId } from "@/helpers/segmented_code";
import { copyToClipboard } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { RemoteAccessInfo } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Cloud, Copy } from "@lucide/vue";
import { computed, ref, useId } from "vue";
import { toast } from "vue-sonner";

/**
 * Music Assistant's own remote access, switched on and off from the setup
 * wizard. The id to connect with is shown, and can be copied, once it is on.
 */

const switchId = useId();
const info = ref<RemoteAccessInfo>();
const busy = ref(false);
// whether the details of remote access that is already on are still coming in
const loadingId = ref(false);
// which request the latest answer belongs to: the read started on mount may
// land after the switch has been answered, and must not undo that answer
// (while a switch the server refused leaves that read as good as it was)
let request = 0;

// what the last answer about remote access said, else what server info says
const enabled = computed(
  () => info.value?.enabled ?? api.serverInfo.value?.has_remote_access ?? false,
);
const remoteId = computed(() => {
  const id = info.value?.remote_id;
  return id ? formatRemoteId(id) : undefined;
});

const load = async function (): Promise<void> {
  const current = ++request;
  loadingId.value = true;
  try {
    const answer = await api.getRemoteAccessInfo();
    if (current === request) info.value = answer;
  } catch (error) {
    // the api already told the user; the switch still follows server info
    console.warn("Failed to load the remote access details:", error);
  } finally {
    loadingId.value = false;
  }
};

const setEnabled = async function (value: boolean): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    const answer = await api.configureRemoteAccess(value);
    // answered: a read still on its way is about the state before this
    request += 1;
    info.value = answer;
    toast.success(
      $t(
        value
          ? "settings.remote_access_enabled_success"
          : "settings.remote_access_disabled_success",
      ),
    );
  } catch (error) {
    // the api already told the user; the switch stays where the server left it
    console.warn("Failed to switch remote access:", error);
  } finally {
    busy.value = false;
  }
};

const copyId = async function (): Promise<void> {
  if (!remoteId.value) return;
  if (await copyToClipboard(remoteId.value)) {
    toast.success($t("settings.remote_access_id_copied"));
  } else {
    toast.error($t("settings.remote_access_error_copy"));
  }
};

// the id is only worth asking for once remote access is on
if (api.serverInfo.value?.has_remote_access) void load();
</script>
