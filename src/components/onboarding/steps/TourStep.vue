<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.tour.description") }}
    </p>

    <div class="grid gap-3 sm:grid-cols-2">
      <Card
        v-for="card in cards"
        :key="card.id"
        class="gap-3"
        data-testid="onboarding-tour-card"
      >
        <CardHeader>
          <span
            class="bg-primary/10 text-primary mb-1 grid size-10 shrink-0 place-items-center rounded-md"
          >
            <component :is="card.icon" class="size-5" aria-hidden="true" />
          </span>
          <CardTitle>
            {{ $t(`onboarding.steps.tour.${card.id}.title`) }}
          </CardTitle>
          <CardDescription>
            {{ $t(`onboarding.steps.tour.${card.id}.description`) }}
          </CardDescription>
        </CardHeader>

        <!-- only where there is a page to open: the search and the player bar
             are always on screen, so there is nowhere to send anyone -->
        <CardContent v-if="card.route">
          <!-- several cards carry this button, so what each one opens is in
               its label for whoever cannot see which card it sits on -->
          <Button
            variant="ghost"
            size="sm"
            class="-ml-3"
            :aria-label="openLabel(card)"
            :data-testid="`onboarding-tour-open-${card.id}`"
            @click="router.push({ name: card.route })"
          >
            {{ $t("onboarding.steps.tour.open") }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </section>
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
import type { OnboardingStepId } from "@/helpers/onboarding";
import { $t } from "@/plugins/i18n";
import { Library, Play, Search, Settings } from "@lucide/vue";
import { markRaw, type Component } from "vue";
import { useRouter } from "vue-router";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const router = useRouter();

interface TourCard {
  id: "library" | "search" | "player_bar" | "profile";
  icon: Component;
  // the named route the card opens, for the areas that are a page of their own
  route?: string;
}

// The four corners of the app a member uses. Only the search carries the icon
// the sidebar knows it by; the rest stand for a group of pages or for the bar
// at the bottom, neither of which has a sidebar icon of its own. The library
// has no page of its own either: the artists are the first of its listings,
// which is where the sidebar's library starts too.
const cards: TourCard[] = [
  { id: "library", icon: markRaw(Library), route: "artists" },
  { id: "search", icon: markRaw(Search) },
  { id: "player_bar", icon: markRaw(Play) },
  { id: "profile", icon: markRaw(Settings), route: "profile" },
];

const openLabel = (card: TourCard) =>
  $t("onboarding.steps.tour.open_named", {
    title: $t(`onboarding.steps.tour.${card.id}.title`),
  });
</script>
