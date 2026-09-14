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
import { Circle, CircleCheck, ListChecks } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();
const { isMobile, setOpenMobile } = useSidebar();
const {
  ctx,
  checklist,
  checklistPending,
  hasPending,
  dismissed,
  dismiss,
  configsLoaded,
  loadProviderConfigs,
} = useOnboarding();

const open = ref(false);

// Whoever onboarding has something for sees the checklist: the admin their
// setup, everyone else who lives here their welcome. Nothing is counted before
// the track's own data is in, which for a member is nothing to wait for.
const visible = computed(
  () =>
    (ctx.value.isMember || (ctx.value.isAdmin && configsLoaded.value)) &&
    hasPending.value &&
    !dismissed.value,
);

// the welcome has nothing to finish setting up, so it says what it is there for
const hintKey = computed(() =>
  ctx.value.isMember
    ? "onboarding.welcome_hint"
    : "onboarding.getting_started_hint",
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

// the checklist is the only reason the sidebar needs the provider
// configurations, and only the setup is counted off them, so nobody but an
// admin ever fetches them
onMounted(() => {
  if (ctx.value.isAdmin) void loadProviderConfigs();
});
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
                    t('onboarding.steps_to_go', checklistPending.length, {
                      named: { count: checklistPending.length },
                    })
                  "
                >
                  {{ checklistPending.length }}
                </Badge>
              </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent side="right" align="start" class="w-64 p-2">
              <p class="text-muted-foreground px-2 pt-1 pb-2 text-xs">
                {{ t(hintKey) }}
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
