<template>
  <OnboardingInvitation
    :features="features"
    :set-up="canManageRemoteAccess && enabled"
    :note="note"
  >
    <OnboardingList>
      <Item size="sm" data-testid="onboarding-remote-access-on">
        <ItemMedia variant="icon">
          <Cloud />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            {{ $t("onboarding.steps.core_settings.remote.on") }}
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          <Button
            variant="ghost"
            size="sm"
            :loading="busy"
            data-testid="onboarding-remote-access-turn-off"
            @click="setEnabled(false)"
          >
            {{ $t("onboarding.steps.core_settings.remote.turn_off") }}
          </Button>
        </ItemActions>
      </Item>
      <Item
        v-if="remoteId || loadingId"
        size="sm"
        data-testid="onboarding-remote-access-id"
      >
        <ItemMedia variant="icon">
          <Globe />
        </ItemMedia>
        <ItemContent class="min-w-0">
          <ItemTitle>
            {{ $t("onboarding.steps.core_settings.remote.builtin.id") }}
          </ItemTitle>
          <!-- the room is kept while the id is on its way, so the step does
               not shift once it lands -->
          <Skeleton
            v-if="!remoteId"
            class="h-5 w-64 max-w-full"
            data-testid="onboarding-remote-access-id-loading"
          />
          <code v-else class="text-sm break-all">{{ remoteId }}</code>
        </ItemContent>
        <ItemActions v-if="remoteId">
          <Button
            variant="ghost"
            size="icon"
            class="size-8"
            :aria-label="
              $t('onboarding.steps.core_settings.remote.builtin.copy')
            "
            :title="$t('onboarding.steps.core_settings.remote.builtin.copy')"
            data-testid="onboarding-remote-access-copy"
            @click="copyId"
          >
            <Copy class="size-4" />
          </Button>
        </ItemActions>
      </Item>
      <Item
        v-if="homeAssistantConnected"
        size="sm"
        data-testid="onboarding-remote-access-home-assistant"
      >
        <ItemMedia class="text-primary size-8 place-items-center">
          <House class="size-5" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle class="font-normal">
            {{ $t(HOME_ASSISTANT_LINK_KEY) }}
          </ItemTitle>
        </ItemContent>
      </Item>
    </OnboardingList>
  </OnboardingInvitation>
</template>

<script setup lang="ts">
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import OnboardingList from "@/components/onboarding/OnboardingList.vue";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboarding } from "@/composables/useOnboarding";
import { useRemoteAccess } from "@/composables/useRemoteAccess";
import type { OnboardingStepId, StepPrimaryAction } from "@/helpers/onboarding";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { Cloud, Copy, Globe, House, Router, ShieldCheck } from "@lucide/vue";
import { computed, markRaw } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const FEATURES: readonly InvitationFeature[] = [
  {
    icon: ShieldCheck,
    labelKey: "onboarding.steps.core_settings.remote.features.secure",
  },
  {
    icon: Router,
    labelKey: "onboarding.steps.core_settings.remote.features.no_setup",
  },
  {
    icon: Globe,
    labelKey: "onboarding.steps.core_settings.remote.features.anywhere",
  },
];

const { ctx } = useOnboarding();
const { enabled, remoteId, loadingId, busy, load, setEnabled, copyId } =
  useRemoteAccess();

// what this admin may do here: a custom role can run the setup without being
// allowed to switch remote access
const canManageRemoteAccess = authManager.hasScope(Scope.SYSTEM_MANAGE);

// the server routes remote access through Home Assistant Link by itself
// whenever the Home Assistant it is connected to has it
const homeAssistantConnected = computed(
  () => ctx.value.homeAssistantAddon || ctx.value.homeAssistantConnected,
);

const HOME_ASSISTANT_LINK_KEY =
  "onboarding.steps.core_settings.remote.features.home_assistant_link";

// what remote access brings; Home Assistant Link only counts for whoever may
// switch remote access, with a Home Assistant to bring it
const features = computed<readonly InvitationFeature[]>(() =>
  canManageRemoteAccess && homeAssistantConnected.value
    ? [...FEATURES, { icon: House, labelKey: HOME_ASSISTANT_LINK_KEY }]
    : FEATURES,
);

// only whoever may turn it on can leave it for later; once it is on, the note
// says where the id is used
const note = computed(() => {
  if (!canManageRemoteAccess) return undefined;
  return enabled.value
    ? $t("onboarding.steps.core_settings.remote.builtin.hint", {
        system: $t("settings.system"),
        network: $t("settings.network.title"),
        remote_access: $t("settings.remote_access"),
      })
    : $t("onboarding.steps.core_settings.optional", {
        system: $t("settings.system"),
        network: $t("settings.network.title"),
      });
});

// until it is on, turning it on is the step's main button
const primaryAction = computed<StepPrimaryAction | undefined>(() =>
  canManageRemoteAccess && !enabled.value
    ? {
        labelKey: "onboarding.steps.core_settings.remote.turn_on",
        icon: markRaw(Cloud),
        run: () => setEnabled(true),
        busy: busy.value,
      }
    : undefined,
);

// the id is only worth asking for once remote access is on, and only by whoever
// may manage it
if (canManageRemoteAccess && enabled.value) void load();

defineExpose({ primaryAction });
</script>
