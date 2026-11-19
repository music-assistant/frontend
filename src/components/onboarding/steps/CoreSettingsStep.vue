<template>
  <OnboardingInvitation
    :intro="$t(introKey)"
    :features="FEATURES"
    :set-up="enabled"
    :linked="enabled"
    :optional="optionalLine"
  >
    <template #partner>
      <Smartphone />
    </template>

    <template v-if="canManageRemoteAccess">
      <Item
        v-if="enabled"
        variant="outline"
        size="sm"
        data-testid="onboarding-remote-access-on"
      >
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
        <ItemFooter
          v-if="remoteId || loadingId"
          class="flex-col items-stretch gap-1"
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
                system: $t("settings.system"),
                network: $t("settings.network.title"),
                remote_access: $t("settings.remote_access"),
              })
            }}
          </p>
        </ItemFooter>
      </Item>

      <Button
        v-else
        size="lg"
        class="self-center"
        :loading="busy"
        data-testid="onboarding-remote-access-turn-on"
        @click="setEnabled(true)"
      >
        <Cloud class="size-4" />
        {{ $t("onboarding.steps.core_settings.remote.turn_on") }}
      </Button>
    </template>

    <template #footer>
      <p
        v-if="canManageRemoteAccess && homeAssistantConnected"
        class="text-muted-foreground text-center text-xs"
        data-testid="onboarding-remote-access-home-assistant"
      >
        {{ $t("onboarding.steps.core_settings.remote.home_assistant") }}
      </p>
    </template>
  </OnboardingInvitation>
</template>

<script setup lang="ts">
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemFooter,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboarding } from "@/composables/useOnboarding";
import { useRemoteAccess } from "@/composables/useRemoteAccess";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { Scope } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import {
  Cloud,
  Copy,
  Globe,
  Router,
  ShieldCheck,
  Smartphone,
} from "@lucide/vue";
import { computed } from "vue";

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

// the add-on is opened wherever Home Assistant is, so its intro says so
const introKey = computed(() =>
  ctx.value.homeAssistantAddon
    ? "onboarding.steps.core_settings.home_network_intro_addon"
    : "onboarding.steps.core_settings.home_network_intro",
);
// the server routes remote access through Home Assistant Link by itself
// whenever the Home Assistant it is connected to has it
const homeAssistantConnected = computed(
  () => ctx.value.homeAssistantAddon || ctx.value.homeAssistantConnected,
);

// only whoever may turn it on can leave it for later
const optionalLine = computed(() =>
  canManageRemoteAccess
    ? $t("onboarding.steps.core_settings.optional", {
        system: $t("settings.system"),
        network: $t("settings.network.title"),
      })
    : undefined,
);

// the id is only worth asking for once remote access is on, and only by whoever
// may manage it
if (canManageRemoteAccess && enabled.value) void load();
</script>
