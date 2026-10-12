<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.invite_members.description") }}
    </p>

    <!-- fixed minimum height so the step does not jump once the users load, and
         a live region so a member who was just added is announced -->
    <div class="flex min-h-24 flex-col gap-2" aria-live="polite">
      <ItemGroup v-if="members.length > 0" class="gap-2">
        <Item
          v-for="member in members"
          :key="member.user_id"
          variant="outline"
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
      </ItemGroup>

      <!-- only once the users are in: an unknown household is not a small one -->
      <p
        v-if="onlyYou"
        class="text-muted-foreground text-sm"
        data-testid="onboarding-only-you"
      >
        {{ $t("onboarding.just_you_so_far") }}
      </p>

      <!-- the household stayed unknown: the step says so rather than passing a
           load that failed off as an empty house -->
      <Empty
        v-if="loadFailed"
        class="border-border rounded-md border border-dashed py-6"
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRound />
          </EmptyMedia>
          <EmptyTitle>
            {{ $t("onboarding.steps.invite_members.load_failed") }}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    </div>

    <div>
      <Button
        :variant="
          memberCount != null && memberCount > 1 ? 'secondary' : 'default'
        "
        data-testid="onboarding-add-member"
        @click="showCreateUserDialog = true"
      >
        <UserPlus class="size-4" />
        {{ $t("onboarding.add_member") }}
      </Button>
    </div>

    <CreateUserDialog v-model="showCreateUserDialog" @created="loadUsers" />
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import CreateUserDialog from "@/components/users/CreateUserDialog.vue";
import { householdMembers, useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { roleDisplayName } from "@/helpers/roles";
import { store } from "@/plugins/store";
import { UserPlus, UserRound } from "@lucide/vue";
import { computed, ref } from "vue";

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
const onlyYou = computed(
  () => memberCount.value != null && memberCount.value <= 1,
);
// the users answered, but with nothing to go on: the wizard only ever opens
// this step once they have, so anything else is a load that did not land
const loadFailed = computed(
  () => dataLoaded.value && memberCount.value == null,
);
</script>
