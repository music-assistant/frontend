<template>
  <section>
    <div class="p-4 space-y-4">
      <!-- header -->
      <div class="space-y-2">
        <h2 class="text-xl font-semibold">
          {{ $t("settings.add_group_player") }}
        </h2>
        <p
          v-if="providerDetails?.domain === 'universal_group'"
          class="text-sm text-muted-foreground whitespace-pre-wrap"
          v-html="
            markdownToHtml($t('settings.add_group_player_desc_universal'))
          "
        ></p>
        <p
          v-else-if="providerDetails?.domain === 'sync_group'"
          class="text-sm text-muted-foreground whitespace-pre-wrap"
          v-html="markdownToHtml($t('settings.add_group_player_desc_sync'))"
        ></p>
        <p
          v-else
          class="text-sm text-muted-foreground whitespace-pre-wrap"
          v-html="
            markdownToHtml(
              $t('settings.add_group_player_desc', [providerDetails?.name]),
            )
          "
        ></p>
      </div>

      <Separator />

      <form class="space-y-4" @submit.prevent="onSubmit">
        <!-- name field -->
        <div class="space-y-1.5">
          <Label for="player-name">{{ $t("settings.player_name") }}</Label>
          <Input id="player-name" v-model="name" required />
        </div>

        <!-- dropdown with group members -->
        <div class="space-y-1.5">
          <Label>{{ $t("settings.group_members") }}</Label>
          <div class="rounded-md border max-h-60 overflow-y-auto">
            <div
              v-for="player in syncPlayers"
              :key="player.player_id"
              class="flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer"
              @click="toggleMember(player.player_id)"
            >
              <Checkbox
                :model-value="members.includes(player.player_id)"
                @update:model-value="toggleMember(player.player_id)"
              />
              <span class="text-sm">{{ player.name }}</span>
            </div>
            <div
              v-if="syncPlayers.length === 0"
              class="px-3 py-4 text-sm text-muted-foreground text-center"
            >
              {{ $t("no_items") }}
            </div>
          </div>
        </div>

        <!-- dynamic mode -->
        <div class="space-y-1.5">
          <div class="flex items-center gap-3">
            <Switch id="dynamic-members" v-model="dynamic" />
            <Label for="dynamic-members" class="cursor-pointer">{{
              $t("settings.dynamic_members.label")
            }}</Label>
          </div>
          <p
            v-if="providerDetails?.domain !== 'universal_group'"
            class="text-xs text-muted-foreground"
          >
            {{ $t("settings.dynamic_members.description") }}
          </p>
        </div>

        <div class="space-y-2 pt-2">
          <Button
            class="w-full"
            :disabled="name.length === 0 || (members.length === 0 && !dynamic)"
            @click="onSubmit"
          >
            {{ $t("settings.save") }}
          </Button>
          <Button variant="outline" class="w-full" @click="router.back()">
            {{ $t("close") }}
          </Button>
        </div>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "@/plugins/api";
import { markdownToHtml } from "@/helpers/utils";
import { PlayerFeature, PlayerType } from "@/plugins/api/interfaces";
import Button from "@/components/Button.vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

// global refs
const router = useRouter();
const name = ref<string>("");
const members = ref<string[]>([]);
const dynamic = ref<boolean>(true);

// props
const props = defineProps<{
  provider: string;
}>();

// computed properties

const providerDetails = computed(() => {
  return api.getProvider(props.provider);
});

const syncPlayers = computed(() => {
  if (props.provider === "universal_group") {
    // for universal groups, show all available non-group players, regardless of provider
    return Object.values(api.players)
      .filter((x) => x.available && x.type != PlayerType.GROUP)
      .sort((a, b) =>
        (a.name ?? "")
          .toUpperCase()
          .localeCompare((b.name ?? "").toUpperCase()),
      );
  }
  if (props.provider === "sync_group") {
    // for sync groups, show all available non-group players that are sync compatible
    return Object.values(api.players)
      .filter((x) => {
        if (!x.available || x.type === PlayerType.GROUP) return false;
        if (!x.supported_features.includes(PlayerFeature.SET_MEMBERS))
          return false;
        // If a player is temporarily synced, can_group_with will be empty.
        // In that case, use the sync leader's can_group_with as a proxy.
        let canGroupWith = x.can_group_with;
        if (
          canGroupWith.length === 0 &&
          x.synced_to &&
          api.players[x.synced_to]
        ) {
          canGroupWith = api.players[x.synced_to].can_group_with;
        }
        if (canGroupWith.length === 0) return false;
        if (members.value.length === 0) return true;
        if (members.value.includes(x.player_id)) return true;
        return members.value.some((m) => canGroupWith.includes(m));
      })
      .sort((a, b) =>
        (a.name ?? "")
          .toUpperCase()
          .localeCompare((b.name ?? "").toUpperCase()),
      );
  }
  return Object.values(api.players)
    .filter(
      (x) =>
        x.available &&
        x.type != PlayerType.GROUP &&
        x.provider == providerDetails.value?.instance_id,
    )
    .sort((a, b) =>
      (a.name ?? "").toUpperCase().localeCompare((b.name ?? "").toUpperCase()),
    );
});

// methods
const toggleMember = (playerId: string) => {
  const idx = members.value.indexOf(playerId);
  if (idx >= 0) {
    members.value.splice(idx, 1);
  } else {
    members.value.push(playerId);
  }
};

const onSubmit = async function () {
  api.createPlayerGroup(
    props.provider,
    name.value,
    members.value,
    dynamic.value,
  );
  router.push({ name: "playersettings" });
};
</script>
