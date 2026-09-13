<template>
  <section class="flex flex-col gap-4">
    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.intent.description") }}
    </p>

    <div class="grid auto-rows-fr gap-3 sm:grid-cols-2">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="hover:border-primary focus-visible:ring-ring bg-card flex items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
        :class="{ 'border-primary': intent === option.value }"
        :aria-pressed="intent === option.value"
        :disabled="busy"
        :data-testid="`onboarding-intent-${option.value}`"
        @click="select(option.value)"
      >
        <span
          class="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-md"
        >
          <component :is="option.icon" class="size-6" />
        </span>
        <span class="flex min-w-0 flex-col gap-1">
          <span class="font-semibold">{{ $t(option.labelKey) }}</span>
          <span class="text-muted-foreground text-sm">
            {{ $t(option.descriptionKey) }}
          </span>
        </span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { OnboardingIntent, OnboardingStepId } from "@/helpers/onboarding";
import { useOnboarding } from "@/composables/useOnboarding";
import { Library, Smartphone } from "@lucide/vue";
import { markRaw, ref } from "vue";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { intent, setIntent } = useOnboarding();

const options = [
  {
    value: "phone_apps" as OnboardingIntent,
    icon: markRaw(Smartphone),
    labelKey: "onboarding.steps.intent.phone_apps.label",
    descriptionKey: "onboarding.steps.intent.phone_apps.description",
  },
  {
    value: "music_hub" as OnboardingIntent,
    icon: markRaw(Library),
    labelKey: "onboarding.steps.intent.music_hub.label",
    descriptionKey: "onboarding.steps.intent.music_hub.description",
  },
];

// the answer is persisted on the server, so the cards stay inert until it lands
const busy = ref(false);

const select = async function (value: OnboardingIntent) {
  if (busy.value) return;
  busy.value = true;
  try {
    await setIntent(value);
  } finally {
    busy.value = false;
  }
  emit("advance");
};
</script>
