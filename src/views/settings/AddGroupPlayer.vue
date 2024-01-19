<template>
  <section>
    <v-card-text>
      <!-- header -->
      <div v-if="provider && provider in api.providers" style="margin-left: -5px; margin-right: -5px">
        <v-card-title>
          {{ $t('settings.add_group_player') }} ({{ api.providers[provider].name }})
        </v-card-title>
        <br />
        <v-divider />
        <br />
        <br />
        <v-form ref="form" v-model="valid" style="margin-right: 10px">
          <!-- name field -->
          <v-text-field v-model="name" :label="$t('settings.player_name')" variant="outlined" clearable required />
          <!-- value with dropdown -->
          <v-select v-model="members" clearable multiple :items="syncPlayers" :label="$t('settings.group_members')"
            required />
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
import { watch } from 'vue';

// global refs
const router = useRouter();
const name = ref<string>("");
const members = ref<string[]>([]);
const valid = ref<boolean>(false);


// props
const props = defineProps<{
  provider: string;
}>();


// computed properties
const syncPlayers = computed(() => {
  // providers that are enabled and support the PLAYER_GROUP_CREATE feature
  return Object.values(api.players)
    .filter(
      (x) =>
        x.provider == props.provider
    )
    .sort((a, b) =>
      (a.display_name).toUpperCase() > (b.display_name).toUpperCase()
        ? 1
        : -1,
    ).map((x) => ({ title: x.display_name, value: x.player_id }));
});

// watchers

watch(
  () => props.provider,
  async (val) => {
    name.value = "";
    valid.value = false;
    members.value = [];
  },
  { immediate: true },
);

// methods
const onSubmit = async function () {
  api.createPlayerGroup(props.provider, name.value, members.value);
  router.push({ name: 'playersettings' });
};
</script>

<style scoped></style>
