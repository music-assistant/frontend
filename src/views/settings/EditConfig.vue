<template>
  <section>
    <v-form
      v-if="entries"
      ref="form"
      v-model="valid"
      style="margin-right: 10px"
      :disabled="disabled"
    >
      <!-- config rows for all config entries -->
      <v-expansion-panels v-model="activePanel" variant="accordion" multiple>
        <!-- 
          we split up the config settings in basic and advanced settings,
          using expansion panels to divide them, where only the advanced one can be expanded/collapsed.
        -->
        <v-expansion-panel v-for="panel of panels" :key="panel" :value="panel">
          <v-expansion-panel-title v-if="panel == 'advanced'">
            <div class="expansion-panel-text">
              {{ $t("settings.advanced_settings") }}
            </div>
          </v-expansion-panel-title>
          <br />
          <v-expansion-panel-text>
            <div
              v-for="conf_item_value of entries.filter(
                (x) => x.advanced == (panel == 'advanced') && !x.hidden
              )"
              :key="conf_item_value.key"
              class="configrow"
            >
              <div class="configcolumnleft">
                <!-- divider value -->
                <div v-if="conf_item_value.type == ConfigEntryType.DIVIDER">
                  <br />
                  <v-divider />
                  <v-label
                    v-if="conf_item_value.label"
                    style="
                      margin-left: 8px;
                      margin-top: 10px;
                      margin-bottom: 10px;
                    "
                  >
                    <b>{{ conf_item_value.label }}</b>
                  </v-label>
                  <br />
                  <br />
                </div>

                <!-- label value -->
                <div v-else-if="conf_item_value.type == ConfigEntryType.LABEL">
                  <br />
                  <v-label
                    style="
                      margin-left: 8px;
                      margin-top: 10px;
                      margin-bottom: 10px;
                    "
                  >
                    {{
                      $t(
                        `settings.${conf_item_value.key}`,
                        conf_item_value.label
                      )
                    }}
                  </v-label>
                </div>

                <!-- action type -->
                <div
                  v-else-if="
                    conf_item_value.type == ConfigEntryType.ACTION ||
                    (conf_item_value.action && !conf_item_value.value)
                  "
                >
                  <br />
                  <v-btn
                    class="actionbutton"
                    :disabled="
                      !!conf_item_value.depends_on &&
                      !getValue(conf_item_value.depends_on)
                    "
                    @click="
                      action(conf_item_value.action || conf_item_value.key);
                      conf_item_value.value = conf_item_value.action
                        ? null
                        : conf_item_value.key;
                    "
                  >
                    {{
                      $t(
                        `settings.${
                          conf_item_value.action || conf_item_value.key
                        }`,
                        conf_item_value.action_label || conf_item_value.label
                      )
                    }}
                  </v-btn>
                </div>

                <!-- boolean value: toggle switch -->
                <v-switch
                  v-else-if="conf_item_value.type == ConfigEntryType.BOOLEAN"
                  v-model="conf_item_value.value"
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  color="primary"
                  :disabled="
                    !!conf_item_value.depends_on &&
                    !getValue(conf_item_value.depends_on)
                  "
                />

                <!-- int/float value in range: slider control -->
                <!-- eslint-disable vue/valid-v-model -->
                <v-slider
                  v-else-if="
                    (conf_item_value.type == ConfigEntryType.INTEGER ||
                      conf_item_value.type == ConfigEntryType.FLOAT) &&
                    conf_item_value.range &&
                    conf_item_value.range.length == 2
                  "
                  v-model="conf_item_value.value as number"
                  :disabled="
                    !!conf_item_value.depends_on &&
                    !getValue(conf_item_value.depends_on)
                  "
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  :required="conf_item_value.required"
                  class="align-center"
                  :min="conf_item_value.range[0]"
                  :max="conf_item_value.range[1]"
                  :step-size="
                    conf_item_value.type == ConfigEntryType.FLOAT ? 0.5 : 1
                  "
                  hide-details
                  style="margin-top: 10px; margin-bottom: 25px"
                  color="primary"
                >
                  <template #append>
                    <v-text-field
                      v-model="conf_item_value.value"
                      hide-details
                      single-line
                      density="compact"
                      type="number"
                      style="width: 70px"
                    />
                  </template>
                </v-slider>
                <!-- eslint-enable vue/valid-v-model -->

                <!-- password value -->
                <v-text-field
                  v-else-if="
                    conf_item_value.type == ConfigEntryType.SECURE_STRING
                  "
                  v-model="conf_item_value.value"
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  :required="conf_item_value.required"
                  :disabled="
                    !!conf_item_value.depends_on &&
                    !getValue(conf_item_value.depends_on)
                  "
                  :rules="[
                    (v) =>
                      !(!v && conf_item_value.required) ||
                      $t('settings.invalid_input'),
                  ]"
                  :type="showPasswordValues ? 'text' : 'password'"
                  :append-inner-icon="
                    showPasswordValues
                      ? 'mdi-eye'
                      : typeof conf_item_value.value == 'string' &&
                        conf_item_value.value.includes(SECURE_STRING_SUBSTITUTE)
                      ? ''
                      : 'mdi-eye-off'
                  "
                  variant="outlined"
                  clearable
                  :readonly="!!conf_item_value.action"
                  @click:append-inner="showPasswordValues = !showPasswordValues"
                />

                <!-- value with dropdown -->
                <v-select
                  v-else-if="
                    conf_item_value.options &&
                    conf_item_value.options.length > 0
                  "
                  v-model="conf_item_value.value"
                  :chips="conf_item_value.multi_value"
                  :clearable="conf_item_value.multi_value"
                  :multiple="conf_item_value.multi_value"
                  :items="conf_item_value.options"
                  :disabled="
                    !!conf_item_value.depends_on &&
                    !getValue(conf_item_value.depends_on)
                  "
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  :required="conf_item_value.required"
                  :rules="[
                    (v) =>
                      !(!v && conf_item_value.required) ||
                      $t('settings.invalid_input'),
                  ]"
                  variant="outlined"
                />
                <!-- int value within range -->
                <v-text-field
                  v-else-if="
                    conf_item_value.type == ConfigEntryType.INTEGER ||
                    conf_item_value.type == ConfigEntryType.FLOAT
                  "
                  v-model="conf_item_value.value"
                  :placeholder="conf_item_value.default_value?.toString()"
                  :disabled="
                    !!conf_item_value.depends_on &&
                    !getValue(conf_item_value.depends_on)
                  "
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  :required="conf_item_value.required"
                  :rules="[
                    (v) =>
                      !(!v && conf_item_value.required) ||
                      $t('settings.invalid_input'),
                  ]"
                  variant="outlined"
                  :clearable="!conf_item_value.required"
                  type="number"
                />
                <!-- all other: textbox with single value -->
                <v-text-field
                  v-else
                  v-model="conf_item_value.value"
                  :placeholder="conf_item_value.default_value?.toString()"
                  clearable
                  :disabled="
                    !!conf_item_value.depends_on &&
                    !getValue(conf_item_value.depends_on)
                  "
                  :label="
                    $t(`settings.${conf_item_value.key}`, conf_item_value.label)
                  "
                  :required="conf_item_value.required"
                  :rules="[
                    (v) =>
                      !(!v && conf_item_value.required) ||
                      $t('settings.invalid_input'),
                  ]"
                  variant="outlined"
                  :readonly="!!conf_item_value.action"
                />
              </div>
              <!-- right side of control: help icon with description-->
              <div
                v-if="conf_item_value.description || conf_item_value.help_link"
                class="configcolumnright"
              >
                <v-btn
                  icon="mdi-help-box"
                  variant="plain"
                  class="helpicon"
                  size="x-large"
                  @click="
                    conf_item_value.description
                      ? (showHelpInfo = conf_item_value)
                      : openLink(conf_item_value.help_link!)
                  "
                />
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      <br />
      <v-btn
        block
        color="primary"
        @click="submit"
        :disabled="!requiredValuesPresent"
      >
        {{ $t("settings.save") }}
      </v-btn>
    </v-form>
    <br />
    <v-btn block @click="$router.back()">
      {{ $t("close") }}
    </v-btn>
    <v-dialog
      :model-value="showHelpInfo !== undefined"
      width="auto"
      @update:model-value="showHelpInfo = undefined"
    >
      <v-card>
        <v-card-text>{{ showHelpInfo?.description }}</v-card-text>
        <v-card-actions>
          <v-btn
            v-if="showHelpInfo?.help_link"
            @click="openLink(showHelpInfo!.help_link!)"
          >
            {{ $t("read_more") }}
          </v-btn>
          <v-spacer />
          <v-btn color="primary" @click="showHelpInfo = undefined">
            {{ $t("close") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, VNodeRef } from "vue";

import {
  ConfigEntryType,
  ConfigValueType,
  SECURE_STRING_SUBSTITUTE,
  ConfigEntry,
} from "@/plugins/api/interfaces";

import { computed, watch } from "vue";

export interface Props {
  configEntries: ConfigEntry[];
  disabled: boolean;
}

const emit = defineEmits<{
  (e: "submit", values: Record<string, ConfigValueType>): void;
  (e: "action", action: string, values: Record<string, ConfigValueType>): void;
}>();

// global refs
const entries = ref<ConfigEntry[]>();
const valid = ref(false);
const form = ref<VNodeRef>();
const activePanel = ref<string>("basic");
const showPasswordValues = ref(false);
const showHelpInfo = ref<ConfigEntry>();
const oldValues = ref<Record<string, ConfigValueType>>({});

// props
const props = defineProps<Props>();

// computed props
const hasAdvanced = computed(() => {
  if (!entries.value) return false;
  return entries.value.filter((x) => x.advanced && !x.hidden).length > 0;
});
const panels = computed(() => {
  if (!hasAdvanced.value) return ["basic"];
  return ["basic", "advanced"];
});
const requiredValuesPresent = computed(() => {
  for (const entry of entries.value!) {
    if (
      entry.required &&
      !(
        !isNullOrUndefined(entry.value) ||
        !isNullOrUndefined(entry.default_value)
        || entry.type == ConfigEntryType.DIVIDER
        || entry.type == ConfigEntryType.LABEL
      )
    )
      return false;
  }
  return true;
});
const currentValues = computed(() => {
  const values: Record<string, ConfigValueType> = {};
  for (const entry of props.configEntries!) {
    // filter out undefined values
    if (entry.value == undefined) continue;
    // filter out obfuscated strings
    if (
      entry.type == ConfigEntryType.SECURE_STRING &&
      entry.value == SECURE_STRING_SUBSTITUTE
    ) {
      continue;
    }
    values[entry.key] = entry.value;
  }
  return values;
});

// watchers
watch(
  () => props.configEntries,
  (val) => {
    entries.value = [];
    for (const entry of val || []) {
      if (!!entry.value) oldValues.value[entry.key] = entry.value;
      if (!entry.value) entry.value = entry.default_value;
      entries.value.push(entry);
    }
  },
  { immediate: true }
);

// methods
const validate = async function (this: any) {
  const { valid } = await (form.value as any).validate();
  return valid;
};
const submit = async function () {
  // submit button is pressed
  if (await validate()) {
    emit("submit", currentValues.value);
  }
};
const action = async function (action: string) {
  // call config entries action
  emit("action", action, currentValues.value);
};
const openLink = function (url: string) {
  window.open(url, "_blank");
};
const getValue = function (key: string) {
  return entries.value?.find((x) => x.key == key)?.value || undefined;
};
const isNullOrUndefined = function (value: any) {
  return value === null || value === undefined;
};
</script>

<style>
.configrow {
  display: flex;
  width: 100%;
}

.configcolumnleft {
  flex: 90%;
}
.configcolumnright {
  align-content: flex-end;
  vertical-align: middle;
}
.helpicon {
  margin-top: 0px;
  margin-right: -10px;
}

.actionbutton.v-btn.v-btn--density-default {
  height: 50px;
  width: 100%;
  margin-top: 0px;
  margin-bottom: 10px;
}

div.v-expansion-panel {
  background-color: transparent;
}

.v-expansion-panel-title__icon {
  margin-right: -20px;
}

.expansion-panel-text {
  margin-left: -20px;
  font-weight: 500;
  font-size: larger;
}
</style>
