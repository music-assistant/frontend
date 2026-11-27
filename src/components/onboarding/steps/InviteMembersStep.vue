<template>
  <div>
    <!-- a live region so a member who was just added is announced -->
    <OnboardingInvitation
      :features="FEATURES"
      :set-up="hasHousehold"
      :note="note"
      aria-live="polite"
    >
      <OnboardingList>
        <OnboardingAddRow
          :icon="UserPlus"
          :label="$t('onboarding.add_member')"
          data-testid="onboarding-add-member"
          @click="showCreateUserDialog = true"
        />
        <Item
          v-for="member in members"
          :key="member.user_id"
          size="sm"
          data-testid="onboarding-household-member"
        >
          <ItemMedia variant="icon">
            <UserRound aria-hidden="true" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{{ member.name }}</ItemTitle>
            <ItemDescription>
              {{ roleDisplayName(member.role, store.roles) }}
            </ItemDescription>
          </ItemContent>
        </Item>
      </OnboardingList>
    </OnboardingInvitation>

    <CreateUserDialog v-model="showCreateUserDialog" @created="loadUsers" />
  </div>
</template>

<script setup lang="ts">
import OnboardingAddRow from "@/components/onboarding/OnboardingAddRow.vue";
import OnboardingInvitation, {
  type InvitationFeature,
} from "@/components/onboarding/OnboardingInvitation.vue";
import OnboardingList from "@/components/onboarding/OnboardingList.vue";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import CreateUserDialog from "@/components/users/CreateUserDialog.vue";
import { householdMembers, useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingStepId, StepPrimaryAction } from "@/helpers/onboarding";
import { roleDisplayName } from "@/helpers/roles";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { LogIn, Music, Speaker, UserPlus, UserRound } from "@lucide/vue";
import { computed, markRaw, ref } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { ctx, dataLoaded, loadUsers } = useOnboarding();

const showCreateUserDialog = ref(false);

// the household as the wizard counts it, which is what this step reads: the
// list below is the same people, spelled out
const memberCount = computed(() => ctx.value.memberCount);
const members = computed(() => householdMembers());
// the admin running the wizard is a household member themselves, so a
// household of one is the admin on their own
const hasHousehold = computed(
  () => memberCount.value != null && memberCount.value > 1,
);
// the users answered, but with nothing to go on: the wizard only ever opens
// this step once they have, so anything else is a load that did not land
const loadFailed = computed(
  () => dataLoaded.value && memberCount.value == null,
);

const FEATURES: readonly InvitationFeature[] = [
  { icon: LogIn, labelKey: "onboarding.steps.invite_members.features.sign_in" },
  {
    icon: Speaker,
    labelKey: "onboarding.steps.invite_members.features.players",
  },
  { icon: Music, labelKey: "onboarding.steps.invite_members.features.music" },
];

// the household stayed unknown: the note says so rather than passing a load
// that failed off as an empty house
const note = computed(() => {
  if (loadFailed.value)
    return $t("onboarding.steps.invite_members.load_failed");
  if (hasHousehold.value) return undefined;
  return $t("onboarding.steps.invite_members.optional", {
    users: $t("auth.user_management"),
  });
});

// while it is just the admin, adding a user is the step's main button
const primaryAction = computed<StepPrimaryAction | undefined>(() =>
  hasHousehold.value
    ? undefined
    : {
        labelKey: "onboarding.add_member",
        icon: markRaw(UserPlus),
        run: () => (showCreateUserDialog.value = true),
      },
);

defineExpose({ primaryAction });
</script>
