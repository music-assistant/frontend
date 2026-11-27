<template>
  <Dialog :open="open" @update:open="setOpen">
    <DialogContent
      class="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-[480px]"
    >
      <DialogHeader class="px-6 pt-6 pb-4">
        <DialogTitle>{{ $t("settings.add_group.title") }}</DialogTitle>
        <DialogDescription v-if="kind?.description">
          {{ kind.description }}
        </DialogDescription>
      </DialogHeader>
      <form
        id="add-group-form"
        ref="form"
        class="min-h-0 flex-1 overflow-y-auto px-6 pb-1"
        novalidate
        @submit.prevent="submit"
      >
        <FieldGroup>
          <FieldSet
            v-if="showKindChoice"
            class="gap-3"
            data-testid="add-group-kinds"
          >
            <FieldLegend variant="label" class="mb-0">
              {{ $t("settings.add_group.kind") }}
            </FieldLegend>
            <RadioGroup
              :model-value="provider"
              :disabled="creating"
              class="gap-2"
              @update:model-value="setKind($event as string)"
            >
              <!-- the header describes the kind picked -->
              <Field
                v-for="option in kinds"
                :key="option.provider"
                orientation="horizontal"
              >
                <RadioGroupItem
                  :id="`add-group-kind-${option.provider}`"
                  :value="option.provider"
                />
                <FieldLabel
                  :for="`add-group-kind-${option.provider}`"
                  class="font-normal"
                >
                  {{ option.name }}
                </FieldLabel>
              </Field>
            </RadioGroup>
          </FieldSet>

          <Field :data-invalid="nameInvalid">
            <FieldLabel for="add-group-name">
              {{ $t("settings.add_group.name") }}
            </FieldLabel>
            <Input
              id="add-group-name"
              v-model="name"
              :aria-invalid="nameInvalid"
              :disabled="creating"
              autocomplete="off"
            />
            <FieldError
              v-if="nameInvalid"
              :errors="[$t('settings.add_group.name_required')]"
            />
          </Field>

          <FieldSet
            :data-invalid="membersInvalid"
            class="gap-2"
            data-testid="add-group-members"
          >
            <FieldLegend variant="label" class="mb-0">
              {{ $t("settings.add_group.members") }}
            </FieldLegend>
            <FieldDescription
              v-if="candidates.length === 0"
              data-testid="add-group-no-speakers"
            >
              {{ $t("settings.add_group.no_speakers") }}
            </FieldDescription>
            <section v-for="section in sections" :key="section.key">
              <!-- a single kind of player needs no heading of its own -->
              <p
                v-if="sections.length > 1"
                class="text-muted-foreground px-2 pt-1 pb-1 text-xs font-medium"
              >
                {{ $t(section.label) }}
              </p>
              <div class="space-y-1">
                <PlayerGroupMemberRow
                  v-for="candidate in section.items"
                  :key="candidate.player_id"
                  :player="candidate"
                  :checkbox-id="`add-group-member-${candidate.player_id}`"
                  :model-value="members.includes(candidate.player_id)"
                  :disabled="creating"
                  @update:model-value="setMember(candidate.player_id, $event)"
                />
              </div>
            </section>
            <FieldError
              v-if="membersInvalid"
              :errors="[$t('settings.add_group.members_required')]"
            />
          </FieldSet>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel for="add-group-dynamic">
                {{ $t("settings.add_group.dynamic") }}
              </FieldLabel>
              <FieldDescription>
                {{ $t("settings.add_group.dynamic_description") }}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="add-group-dynamic"
              v-model="dynamic"
              :disabled="creating"
            />
          </Field>
        </FieldGroup>
      </form>
      <!-- outside the scrolled form, so it shows next to the button that failed -->
      <div v-if="error" class="px-6 pt-4">
        <Alert variant="destructive" data-testid="add-group-error">
          <TriangleAlert />
          <AlertDescription>{{ error }}</AlertDescription>
        </Alert>
      </div>
      <DialogFooter class="px-6 pt-4 pb-6">
        <Button variant="outline" :disabled="creating" @click="close">
          {{ $t("cancel") }}
        </Button>
        <Button
          type="submit"
          form="add-group-form"
          data-testid="add-group-create"
          :loading="creating"
        >
          {{ $t("create") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import PlayerGroupMemberRow from "@/components/PlayerGroupMemberRow.vue";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useAddGroupForm } from "@/composables/settings/players/useAddGroupForm";
import { playerSections } from "@/helpers/player_sections";
import { type AddGroupDialogEvent, eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { TriangleAlert } from "@lucide/vue";
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";

const open = ref(false);
const formElement = useTemplateRef<HTMLFormElement>("form");
let onCreated: AddGroupDialogEvent["onCreated"];

const {
  kinds,
  kind,
  provider,
  showKindChoice,
  name,
  members,
  dynamic,
  candidates,
  creating,
  error,
  nameInvalid,
  membersInvalid,
  reset,
  setKind,
  setMember,
  create,
} = useAddGroupForm();

const sections = computed(() =>
  playerSections(candidates.value, (player) => player.type),
);

watch(open, (value) => {
  store.dialogActive = value;
});

const onDialogRequested = (evt: AddGroupDialogEvent) => {
  reset(evt.provider);
  onCreated = evt.onCreated;
  open.value = true;
};

onMounted(() => {
  eventbus.on("addGroupDialog", onDialogRequested);
});

onBeforeUnmount(() => {
  // named so this drops only its own listener, not every listener for the event
  eventbus.off("addGroupDialog", onDialogRequested);
  if (open.value) store.dialogActive = false;
});

async function submit() {
  const player = await create();
  if (player) {
    close();
    onCreated?.(player.player_id);
    return;
  }
  // a field that misses its value may be scrolled out of view
  await nextTick();
  formElement.value
    ?.querySelector("[data-invalid=true]")
    ?.scrollIntoView({ block: "nearest" });
}

function setOpen(value: boolean) {
  if (!value && !creating.value) close();
}

function close() {
  open.value = false;
}
</script>
