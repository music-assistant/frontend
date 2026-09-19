<template>
  <section class="flex flex-col gap-4">
    <p :id="DESCRIPTION_ID" class="text-muted-foreground text-sm">
      {{ $t("onboarding.steps.account.description") }}
    </p>

    <!-- the account is there and the app is signed in with it: the step is
         done, and says so to whoever comes back to it -->
    <p
      v-if="ctx.signedIn"
      class="text-sm"
      data-testid="onboarding-account-ready"
    >
      {{ $t("onboarding.steps.account.ready", { name }) }}
    </p>

    <!-- the browser is on its way to the client that started the setup, and
         the app on this page will not be signed in; whoever stays here can
         sign in the usual way, which a reload leads to now that there is an
         account -->
    <div
      v-else-if="phase === 'handed_back'"
      class="flex flex-col items-start gap-4"
      data-testid="onboarding-account-handed-back"
    >
      <p class="text-sm">{{ $t("onboarding.steps.account.handed_back") }}</p>
      <Button
        variant="outline"
        data-testid="onboarding-account-sign-in-here"
        @click="reload"
      >
        {{ $t("onboarding.steps.account.sign_in_here") }}
      </Button>
    </div>

    <form
      v-else
      id="form-onboarding-account"
      novalidate
      :aria-describedby="DESCRIPTION_ID"
      @submit.prevent="submit"
    >
      <FieldGroup>
        <form.Field name="username">
          <template #default="{ field }">
            <Field :data-invalid="isInvalid(field)">
              <FieldLabel :for="field.name">
                {{ $t("auth.username") }}
              </FieldLabel>
              <Input
                :id="field.name"
                :name="field.name"
                :model-value="field.state.value"
                :aria-invalid="isInvalid(field)"
                :disabled="locked"
                autocomplete="username"
                @blur="field.handleBlur"
                @input="
                  (e: Event) => {
                    field.handleChange((e.target as HTMLInputElement).value);
                  }
                "
              />
              <FieldError
                v-if="isInvalid(field)"
                :errors="field.state.meta.errors"
              />
            </Field>
          </template>
        </form.Field>

        <form.Field name="displayName">
          <template #default="{ field }">
            <Field :data-invalid="isInvalid(field)">
              <FieldLabel :for="field.name">
                {{ $t("auth.display_name") }}
              </FieldLabel>
              <Input
                :id="field.name"
                :name="field.name"
                :model-value="field.state.value"
                :aria-invalid="isInvalid(field)"
                :disabled="locked"
                autocomplete="name"
                @blur="field.handleBlur"
                @input="
                  (e: Event) => {
                    field.handleChange((e.target as HTMLInputElement).value);
                  }
                "
              />
              <FieldError
                v-if="isInvalid(field)"
                :errors="field.state.meta.errors"
              />
              <FieldDescription v-else>
                {{ $t("optional") }}
              </FieldDescription>
            </Field>
          </template>
        </form.Field>

        <form.Field name="password">
          <template #default="{ field }">
            <Field :data-invalid="isInvalid(field)">
              <FieldLabel :for="field.name">
                {{ $t("auth.password") }}
              </FieldLabel>
              <Input
                :id="field.name"
                :name="field.name"
                type="password"
                :model-value="field.state.value"
                :aria-invalid="isInvalid(field)"
                :disabled="locked"
                autocomplete="new-password"
                @blur="field.handleBlur"
                @input="
                  (e: Event) => {
                    field.handleChange((e.target as HTMLInputElement).value);
                  }
                "
              />
              <FieldError
                v-if="isInvalid(field)"
                :errors="field.state.meta.errors"
              />
            </Field>
          </template>
        </form.Field>

        <form.Field name="confirmPassword">
          <template #default="{ field }">
            <Field :data-invalid="isInvalid(field)">
              <FieldLabel :for="field.name">
                {{ $t("auth.confirm_password") }}
              </FieldLabel>
              <Input
                :id="field.name"
                :name="field.name"
                type="password"
                :model-value="field.state.value"
                :aria-invalid="isInvalid(field)"
                :disabled="locked"
                autocomplete="new-password"
                @blur="field.handleBlur"
                @input="
                  (e: Event) => {
                    field.handleChange((e.target as HTMLInputElement).value);
                  }
                "
              />
              <FieldError
                v-if="isInvalid(field)"
                :errors="field.state.meta.errors"
              />
            </Field>
          </template>
        </form.Field>
      </FieldGroup>

      <Alert
        v-if="failure"
        variant="destructive"
        class="mt-4"
        data-testid="onboarding-account-error"
      >
        <AlertDescription>{{ failure }}</AlertDescription>
      </Alert>

      <div class="mt-4 flex items-center gap-3">
        <!-- once the sign-in has been given up on, a reload is the way on:
             the account is there, and the page signs in with it -->
        <Button
          v-if="phase === 'sign_in_failed'"
          type="button"
          variant="outline"
          data-testid="onboarding-account-reload"
          @click="reload"
        >
          {{ $t("onboarding.steps.account.reload") }}
        </Button>
        <Button
          v-else
          type="submit"
          :disabled="locked"
          :loading="busy"
          data-testid="onboarding-account-create"
        >
          {{ $t("onboarding.steps.account.create") }}
        </Button>
        <!-- always in the page, so what is announced is a change to it -->
        <span
          class="text-muted-foreground text-sm"
          aria-live="polite"
          data-testid="onboarding-account-progress"
        >
          {{ busy ? $t(`onboarding.steps.account.${phase}`) : "" }}
        </span>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  AccountSetupError,
  useFirstRunSetup,
} from "@/composables/useFirstRunSetup";
import { useOnboarding } from "@/composables/useOnboarding";
import type { OnboardingStepId } from "@/helpers/onboarding";
import { userDisplayName } from "@/helpers/provider_access";
import { firstRunAccountSchema } from "@/lib/forms/profile";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import type { AnyFieldApi } from "@tanstack/form-core";
import { useForm } from "@tanstack/vue-form";
import { computed, onBeforeUnmount, ref, watch } from "vue";

// what the form answers, for the screen readers that read it out first
const DESCRIPTION_ID = "onboarding-account-description";
// how long the app gets to sign in with the new account before the step says
// it did not
const SIGN_IN_TIMEOUT_MS = 20_000;

// the wizard hands the same listeners to every step; declaring them all keeps
// the ones this step does not raise off its root element
const emit = defineEmits<{
  (e: "advance"): void;
  (e: "navigate", step: OnboardingStepId): void;
  (e: "finish"): void;
}>();

const { ctx } = useOnboarding();
const { createAccount } = useFirstRunSetup();

// where the step is at: taking the details, making the account, waiting for
// the app to sign in with it, having handed the browser to the client that
// started the setup, or having given up waiting for the sign-in
type Phase =
  | "idle"
  | "creating"
  | "signing_in"
  | "handed_back"
  | "sign_in_failed";

const phase = ref<Phase>("idle");
const busy = computed(
  () => phase.value === "creating" || phase.value === "signing_in",
);
// the form is submitted once: from then on the account is there, whatever
// the app makes of it, and a second one could not be made anyway
const locked = computed(() => phase.value !== "idle");
const failure = ref<string | null>(null);

// the done state only ever shows once someone is signed in, so the empty name
// is there for the type rather than for a message anyone will read
const name = computed(() =>
  store.currentUser ? userDisplayName(store.currentUser) : "",
);

const isInvalid = (field: AnyFieldApi) => field.state.meta.errors.length > 0;

const form = useForm({
  defaultValues: {
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
  },
  validators: {
    onSubmit: firstRunAccountSchema($t),
  },
  onSubmit: async ({ value }) => {
    failure.value = null;
    phase.value = "creating";
    try {
      phase.value = await createAccount({
        username: value.username.trim(),
        password: value.password,
        displayName: value.displayName.trim(),
      });
    } catch (error) {
      failure.value =
        error instanceof AccountSetupError && error.reason
          ? error.reason
          : $t("onboarding.steps.account.failed");
      phase.value = "idle";
    }
  },
});

const submit = () => form.handleSubmit();

// the account is there by then, so the page signs in with it, or offers the
// usual sign-in to whoever the hand-back left behind
const reload = () => window.location.reload();

// The app signs in with the new account behind the wizard, which moves on the
// moment it has. One that does not get there in time is told so rather than
// left waiting: the account is there all the same, and a reload signs in with
// it.
let signInTimer: ReturnType<typeof setTimeout> | undefined;

watch(phase, (current) => {
  clearTimeout(signInTimer);
  if (current !== "signing_in") return;
  signInTimer = setTimeout(() => {
    failure.value = $t("onboarding.steps.account.sign_in_failed");
    phase.value = "sign_in_failed";
  }, SIGN_IN_TIMEOUT_MS);
});

watch(
  () => ctx.value.signedIn,
  (signedIn) => {
    if (!signedIn) return;
    // the wait is over before the wizard is asked to move, as it stands aside
    // while the step is busy
    phase.value = "idle";
    emit("advance");
  },
);

onBeforeUnmount(() => clearTimeout(signInTimer));

// the wizard may only leave once the account is there: there is nothing else
// to do on a server nobody can sign in to
const beforeLeave = async (): Promise<boolean> => ctx.value.signedIn;

// the form submits itself, so the wizard's Next stands down until it has
const ownsForwardAction = computed(() => !ctx.value.signedIn);

defineExpose({ beforeLeave, busy, ownsForwardAction });
</script>
