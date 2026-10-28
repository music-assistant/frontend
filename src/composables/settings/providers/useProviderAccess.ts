import {
  effectiveProviderAccess,
  getProviderSharingTranslationKey,
  isOwnMusicSource,
  servesNobody,
  shareCandidates,
  userDisplayName,
} from "@/helpers/provider_access";
import { api } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderSharing,
  type User,
  type UserSummary,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, type MaybeRefOrGetter, ref, toValue, watch } from "vue";
import { toast } from "vue-sonner";

interface UseProviderAccessOptions {
  managesAllSources: MaybeRefOrGetter<boolean>;
  canOwnSources: MaybeRefOrGetter<boolean>;
  // whether the users to name and share with are needed yet; they are listed
  // once it holds, right away when left out
  needsUsers?: MaybeRefOrGetter<boolean>;
}

/**
 * The owner and sharing of music sources: who they may be shared with, the
 * compact access summary shown per source, and the access dialog.
 */
export function useProviderAccess(options: UseProviderAccessOptions) {
  const users = ref<User[]>([]);
  // the members a member may share its sources with, null until listed
  const memberShareCandidates = ref<UserSummary[] | null>(null);
  const accessDialogConfig = ref<ProviderConfig | null>(null);
  const showAccessDialog = ref(false);

  const usersById = computed(
    () => new Map(users.value.map((user) => [user.user_id, user])),
  );

  // an admin picks the members to share with from its own user list
  const accessShareCandidates = computed(() =>
    toValue(options.managesAllSources)
      ? shareCandidates(users.value)
      : memberShareCandidates.value,
  );

  // the access record in its compact form: "<owner> · <who it is shared with>",
  // without the owner for a member, which only summarizes its own sources; a
  // source nobody can use says so instead
  const accessSummary = function (item: ProviderConfig) {
    const access = effectiveProviderAccess(item.access);
    if (servesNobody(access)) return $t("settings.source_access.nobody");
    const sharedCount = access.shared_users.length;
    const sharing =
      access.sharing === ProviderSharing.SELECTED
        ? $t("settings.source_access.shared_with_count", sharedCount, {
            named: { count: sharedCount },
          })
        : $t(
            getProviderSharingTranslationKey(
              access.sharing,
              isOwnMusicSource(item, store.currentUser?.user_id),
            ),
          );
    if (!toValue(options.managesAllSources)) return sharing;
    const owner =
      access.owner === null
        ? $t("settings.source_access.household")
        : getUserName(access.owner);
    return `${owner} · ${sharing}`;
  };

  let usersLoaded = false;
  let usersLoading = false;
  const loadUsers = async function () {
    if (usersLoaded || usersLoading) return;
    usersLoading = true;
    try {
      users.value = await api.getAllUsers();
      usersLoaded = true;
    } catch {
      toast.error($t("auth.users_load_failed"));
    } finally {
      usersLoading = false;
    }
  };

  let candidatesLoading = false;
  const loadShareCandidates = async function () {
    if (memberShareCandidates.value !== null || candidatesLoading) return;
    candidatesLoading = true;
    try {
      memberShareCandidates.value = await api.getShareCandidates();
    } catch {
      toast.error($t("auth.users_load_failed"));
    } finally {
      candidatesLoading = false;
    }
  };

  const requestUsers = function () {
    // Listing users is an admin call; members use the share candidates list.
    if (toValue(options.managesAllSources)) void loadUsers();
    else if (toValue(options.canOwnSources)) void loadShareCandidates();
  };

  const openAccessDialog = function (config: ProviderConfig) {
    if (!showAccessDialog.value) requestUsers();
    accessDialogConfig.value = config;
    showAccessDialog.value = true;
  };

  // a user that is no longer in the list is shown by its id
  const getUserName = function (userId: string) {
    const user = usersById.value.get(userId);
    return user ? userDisplayName(user) : userId;
  };

  let usersRequested = false;
  watch(
    () => toValue(options.needsUsers ?? true),
    (needed) => {
      if (!needed || usersRequested) return;
      usersRequested = true;
      requestUsers();
    },
    { immediate: true },
  );

  return {
    users,
    accessShareCandidates,
    accessDialogConfig,
    showAccessDialog,
    accessSummary,
    openAccessDialog,
  };
}
