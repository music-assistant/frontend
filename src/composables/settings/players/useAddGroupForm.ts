import {
  getGroupKinds,
  getGroupMemberCandidates,
} from "@/helpers/player_group";
import { api, ApiCommandError } from "@/plugins/api";
import type { Player } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref } from "vue";
import { toast } from "vue-sonner";

/**
 * The form that creates a group: the kind of group, its name, its members and whether
 * players may join and leave it later.
 */
export function useAddGroupForm() {
  const kinds = computed(() =>
    getGroupKinds(api.providers, api.providerManifests),
  );
  // the instance id of the provider that creates the group
  const provider = ref<string>();
  // a form opened for one provider offers no other kind
  const kindFixed = ref(false);
  const name = ref("");
  const members = ref<string[]>([]);
  const dynamic = ref(true);
  // the required fields are only flagged once creating was tried
  const submitted = ref(false);
  const creating = ref(false);
  const error = ref<string | null>(null);

  const kind = computed(() =>
    kinds.value.find((option) => option.provider === provider.value),
  );
  const showKindChoice = computed(
    () => !kindFixed.value && kinds.value.length > 1,
  );
  const candidates = computed(() =>
    kind.value
      ? getGroupMemberCandidates(api.players, kind.value.domain, members.value)
      : [],
  );
  const nameMissing = computed(() => !name.value.trim());
  // a group that players may join later can start without members
  const membersMissing = computed(
    () => !dynamic.value && members.value.length === 0,
  );
  const nameInvalid = computed(() => submitted.value && nameMissing.value);
  const membersInvalid = computed(
    () => submitted.value && membersMissing.value,
  );

  /**
   * Empty the form.
   *
   * @param fixedProvider - The instance id of the only provider to offer, else the
   *   form starts on the first kind of group.
   */
  function reset(fixedProvider?: string) {
    kindFixed.value = fixedProvider !== undefined;
    provider.value = fixedProvider ?? kinds.value[0]?.provider;
    name.value = "";
    members.value = [];
    dynamic.value = true;
    submitted.value = false;
    creating.value = false;
    error.value = null;
  }

  /** Pick another kind of group, which takes other members. */
  function setKind(value: string) {
    if (value === provider.value) return;
    provider.value = value;
    members.value = [];
  }

  function setMember(playerId: string, selected: boolean) {
    members.value = selected
      ? [...members.value, playerId]
      : members.value.filter((id) => id !== playerId);
  }

  /** Create the group and return it; undefined when a value is missing or the server refuses. */
  async function create(): Promise<Player | undefined> {
    submitted.value = true;
    if (!kind.value || nameMissing.value || membersMissing.value) {
      return undefined;
    }
    const groupName = name.value.trim();
    creating.value = true;
    error.value = null;
    try {
      const player = await api.createPlayerGroup(
        kind.value.provider,
        groupName,
        members.value,
        dynamic.value,
      );
      toast.success($t("settings.add_group.created", [groupName]));
      return player;
    } catch (err) {
      // the form stays open, so the reason shows next to what the user can change
      error.value =
        err instanceof ApiCommandError && err.details
          ? err.details
          : $t("settings.add_group.failed");
      return undefined;
    } finally {
      creating.value = false;
    }
  }

  return {
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
  };
}
