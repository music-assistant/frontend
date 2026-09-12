<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { authManager } from "@/plugins/auth";
import { Circle, CircleCheck, ListChecks } from "@lucide/vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();
const { isMobile, setOpenMobile } = useSidebar();
const { ctx, steps, requiredPending, hasPending, dismissed, dismiss } =
  useOnboarding();

const open = ref(false);

// Onboarding is an admin job; nobody else ever sees the checklist.
const visible = computed(
  () => authManager.isAdmin() && hasPending.value && !dismissed.value,
);

// The summary step is the wizard's own ending, not something to tick off.
const checklist = computed(() =>
  steps.value.filter((step) => step.kind !== "summary"),
);

const openStep = function (step: OnboardingStepId) {
  open.value = false;
  if (isMobile.value) setOpenMobile(false);
  router.push({ name: "onboarding", query: { step } });
};

const hideForNow = function () {
  open.value = false;
  dismiss();
};
</script>

<template>
  <SidebarGroup v-if="visible" data-testid="nav-getting-started">
    <SidebarGroupContent class="flex flex-col gap-0.5">
      <SidebarMenu>
        <SidebarMenuItem class="mr-1.5 group-data-[collapsible=icon]:mr-0">
          <Popover v-model:open="open">
            <PopoverTrigger as-child>
              <SidebarMenuButton
                class="text-sm font-medium no-underline"
                :title="t('onboarding.getting_started')"
                data-testid="getting-started-trigger"
              >
                <ListChecks class="getting-started-icon mr-1" />
                <span class="min-w-0 truncate">
                  {{ t("onboarding.getting_started") }}
                </span>
                <Badge
                  class="ml-auto shrink-0 group-data-[collapsible=icon]:hidden"
                  :aria-label="
                    t('onboarding.steps_to_go', requiredPending.length, {
                      named: { count: requiredPending.length },
                    })
                  "
                >
                  {{ requiredPending.length }}
                </Badge>
              </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" class="w-64 p-2">
              <p class="text-muted-foreground px-2 pt-1 pb-2 text-xs">
                {{ t("onboarding.getting_started_hint") }}
              </p>
              <ul class="flex flex-col gap-0.5">
                <li v-for="step in checklist" :key="step.id">
                  <button
                    type="button"
                    class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm focus-visible:ring-2 focus-visible:outline-none"
                    data-testid="getting-started-step"
                    @click="openStep(step.id)"
                  >
                    <CircleCheck
                      v-if="step.isDone(ctx)"
                      class="text-primary size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <Circle
                      v-else
                      class="text-muted-foreground size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span class="min-w-0 truncate">
                      {{ t(`onboarding.steps.${step.id}.title`) }}
                    </span>
                    <span
                      v-if="step.optional && !step.isDone(ctx)"
                      class="text-muted-foreground ml-auto shrink-0 text-xs"
                    >
                      {{ t("optional") }}
                    </span>
                  </button>
                </li>
              </ul>
              <Button
                variant="ghost"
                size="sm"
                class="mt-1 w-full justify-start"
                data-testid="getting-started-dismiss"
                @click="hideForNow"
              >
                {{ t("onboarding.hide_for_now") }}
              </Button>
            </PopoverContent>
          </Popover>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>

<style scoped>
/* AppSidebar sizes every menu-button svg globally, so match the other nav items
   by selecting this icon's own class, which outweighs that rule (see
   NavShortcuts.vue for the same pattern) instead of restating it. */
:deep([data-sidebar="menu-button"] > svg.getting-started-icon) {
  width: 1.2rem !important;
  height: 1.2rem !important;
  padding-right: 3px !important;
}
</style>
