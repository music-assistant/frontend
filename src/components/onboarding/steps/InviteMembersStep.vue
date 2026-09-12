<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.invite_members.description") }}
    </p>

    <!-- fixed minimum height so the step does not jump once the users load -->
    <div class="flex min-h-24 flex-col gap-2">
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
              {{ $t(`auth.${member.role}_role`) }}
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
    </div>

    <div>
      <Button
        :variant="members.length > 1 ? 'secondary' : 'default'"
        data-testid="onboarding-add-member"
        @click="showCreateUserDialog = true"
      >
        <UserPlus class="size-4" />
        {{ $t("onboarding.add_member") }}
      </Button>
    </div>

    <CreateUserDialog v-model="showCreateUserDialog" @created="reloadUsers" />
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
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
import { UserPlus, UserRound } from "@lucide/vue";
import { computed, ref } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { ctx, reloadUsers } = useOnboarding();

const showCreateUserDialog = ref(false);

const members = computed(() => householdMembers());
// the admin running the wizard is a household member themselves, so a
// household of one is the admin on their own
const onlyYou = computed(
  () => ctx.value.memberCount != null && members.value.length <= 1,
);
</script>
