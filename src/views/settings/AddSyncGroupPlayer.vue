<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div style="margin-left: -5px; margin-right: -5px">
        <v-card-title>
          {{ $t('settings.create_sync_group_player') }}
        </v-card-title>
        <v-card-subtitle style="white-space: break-spaces">
          {{ $t('settings.create_sync_group_player_desc') }}
        </v-card-subtitle>
        <br />
        <v-divider />
        <br />
        <br />
        <v-form ref="form" v-model="valid" style="margin-right: 10px">
          <!-- name field -->
          <v-text-field
            v-model="name"
            :label="$t('settings.player_name')"
            variant="outlined"
            clearable
            required
          />
          <!-- value with dropdown -->
          <v-select
            v-model="members"
            clearable
            multiple
            :items="syncPlayers"
            item-title="display_name"
            item-value="player_id"
            :label="$t('settings.group_members')"
            required
          />
          <br />
          <v-btn block color="primary" :disabled="!valid" @click="onSubmit">
            {{ $t('settings.save') }}
          </v-btn>
        </v-form>
        <br />
        <v-btn block @click="router.back()">
          {{ $t('close') }}
        </v-btn>
      </div>
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/plugins/api';
import { ProviderFeature } from '@/plugins/api/interfaces';

// global refs
const router = useRouter();
const name = ref<string>('');
const members = ref<string[]>([]);
const valid = ref<boolean>(false);

// computed properties
const syncPlayers = computed(() => {
  if (members.value.length > 0) {
    return Object.values(api.players).filter(
      (x) =>
        x.available &&
        (x.can_sync_with.includes(members.value[0]) ||
          x.player_id == members.value[0]) &&
        api
          .getProvider(x.provider)
          ?.supported_features.includes(ProviderFeature.SYNC_PLAYERS),
    );
  }
  return Object.values(api.players).filter(
    (x) =>
      x.available &&
      x.can_sync_with.length &&
      api
        .getProvider(x.provider)
        ?.supported_features.includes(ProviderFeature.SYNC_PLAYERS),
  );
});

// methods
const onSubmit = async function () {
  api.createSyncPlayerGroup(name.value, members.value);
  router.push({ name: 'playersettings' });
};
</script>
