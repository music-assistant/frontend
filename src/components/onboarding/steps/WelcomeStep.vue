<template>
  <section class="flex flex-col gap-4">
    <p
      :id="DESCRIPTION_ID"
      class="text-muted-foreground text-sm"
      data-testid="onboarding-greeting"
    >
      {{ $t("onboarding.steps.welcome.description", { name }) }}
    </p>

    <ChoiceCards
      :options="options"
      :selected="shown"
      :busy="busy"
      :labelled-by="DESCRIPTION_ID"
      test-id-prefix="onboarding-persona"
      @select="select"
    />

    <p class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.welcome.defaults_hint") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import ChoiceCards, {
  type ChoiceCardOption,
} from "@/components/onboarding/ChoiceCards.vue";
import { useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingPersona, OnboardingStepId } from "@/helpers/onboarding";
import { userDisplayName } from "@/helpers/provider_access";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { AudioLines, Play } from "@lucide/vue";
import { computed, markRaw, ref } from "vue";
import { toast } from "vue-sonner";

// what the cards answer, for the screen readers that read it out first
const DESCRIPTION_ID = "onboarding-welcome-description";

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { persona, setPersona } = useOnboarding();

// the welcome only ever opens on someone who is signed in, so the empty name
// is there for the type rather than for a greeting anyone will read
const name = computed(() =>
  store.currentUser ? userDisplayName(store.currentUser) : "",
);

const options: ChoiceCardOption<OnboardingPersona>[] = [
  {
    value: "enthusiast",
    icon: markRaw(AudioLines),
    labelKey: "onboarding.steps.welcome.enthusiast.label",
    descriptionKey: "onboarding.steps.welcome.enthusiast.description",
  },
  {
    value: "regular",
    icon: markRaw(Play),
    labelKey: "onboarding.steps.welcome.regular.label",
    descriptionKey: "onboarding.steps.welcome.regular.description",
    recommended: true,
  },
];

// the answer shown as chosen until the member picks one
const recommended = options.find((option) => option.recommended)!.value;

// the answer the member gave here, kept even when the account did not take
// it: the card stays chosen, and moving on tries it again
const chosen = ref<OnboardingPersona | null>(null);

// what the cards show as chosen, and what moving on writes: the answer given
// here, else the one on the account, else the recommended one
const shown = computed(() => chosen.value ?? persona.value ?? recommended);

// the answer is persisted on the server, so the cards stay inert until it lands
const busy = ref(false);
// the answer on its way to the server, which the wizard waits for before it
// moves off this step
let pendingSave: Promise<boolean> | null = null;

const save = async function (value: OnboardingPersona): Promise<boolean> {
  busy.value = true;
  try {
    const saved = await setPersona(value);
    // an answer that did not reach the server is not an answer: say so here,
    // where it was given, rather than wherever the member has got to by then
    if (!saved) toast.error($t("onboarding.steps.welcome.save_failed"));
    return saved;
  } finally {
    busy.value = false;
    pendingSave = null;
  }
};

const select = async function (value: OnboardingPersona) {
  if (busy.value) return;
  chosen.value = value;
  pendingSave = save(value);
  if (await pendingSave) emit("advance");
};

/**
 * The wizard asking whether it may move on. An answer still on its way is
 * waited for here, so the member is not walked onto the next step by an
 * answer the account never took, and is told about it on the step that asked.
 * Otherwise moving on writes the answer the cards show as chosen, unless the
 * account already holds it: the recommended one for a member who picked
 * nothing, or their own pick again when the account did not take it before.
 */
const beforeLeave = async function (): Promise<boolean> {
  if (pendingSave) return await pendingSave;
  if (shown.value === persona.value) return true;
  pendingSave = save(shown.value);
  return await pendingSave;
};

defineExpose({ beforeLeave, busy });
</script>
