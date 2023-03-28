<template>
  <section>
    <v-form
      v-if="conf"
      ref="form"
      v-model="valid"
      style="margin-right: 10px"
    >
      <!-- name field -->
      <v-text-field
        v-if="'name' in conf"
        v-model="conf.name"
        :placeholder="modelValue?.name"
        :label="
          'player_id' in conf
            ? $t('settings.player_name')
            : $t('settings.provider_name')
        "
        variant="outlined"
        clearable
      />

      <!-- enable field -->
      <v-switch
        v-if="'enabled' in conf"
        v-model="conf.enabled"
        :label="
          'player_id' in conf
            ? $t('settings.enable_player')
            : $t('settings.enable_provider')
        "
        color="primary"
        :disabled="isBuiltin"
      />
      <v-divider />
      <!-- config rows for all config entries -->
      <v-expansion-panels
        v-if="conf.enabled"
        v-model="activePanel"
        variant="accordion"
        multiple
      >
        <!-- 
          we split up the config settings in basic and advanced settings,
          using expansion panels to divide them, where only the advanced one can be expanded/collapsed.
        -->
        <v-expansion-panel
          v-for="panel of panels"
          :key="panel"
          :value="panel"
        >
          <v-expansion-panel-title v-if="panel == 'advanced'">
            <div class="expansion-panel-text">
              {{ $t("settings.advanced_settings") }}
            </div>
          </v-expansion-panel-title>
          <br>
          <v-expansion-panel-text>
            <div
              v-for="conf_item_value of Object.values(conf.values).filter(
                (x) => x.advanced == (panel == 'advanced') && !x.hidden
              )"
              :key="conf_item_value.key"
              class="configrow"
            >
              <div class="configcolumnleft">
                <!-- label value -->

                <div v-if="conf_item_value.type == ConfigEntryType.LABEL">
                  <br>
                  <v-divider />
                  <v-label
                    style="
                      margin-left: 8px;
                      margin-top: 10px;
                      margin-bottom: 10px;
                    "
                  >
                    <b>{{ conf_item_value.value?.toString() }}</b>
                  </v-label>
                  <br>
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
                    conf_item_value.depends_on != undefined &&
                      !conf.values[conf_item_value.depends_on].value
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
                    conf_item_value.depends_on != undefined &&
                      !conf.values[conf_item_value.depends_on].value
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
                    conf_item_value.depends_on != undefined &&
                      !conf.values[conf_item_value.depends_on].value
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
                  :placeholder="conf_item_value.default_value?.toString()"
                  :disabled="
                    conf_item_value.depends_on != undefined &&
                      !conf.values[conf_item_value.depends_on].value
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
                <!-- int value withour range -->
                <v-text-field
                  v-else-if="(conf_item_value.type == ConfigEntryType.INTEGER ||
                    conf_item_value.type == ConfigEntryType.FLOAT)"
                  v-model="conf_item_value.value"
                  :placeholder="conf_item_value.default_value?.toString()"
                  :disabled="
                    conf_item_value.depends_on != undefined &&
                      !conf.values[conf_item_value.depends_on].value
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
                  :disabled="
                    conf_item_value.depends_on != undefined &&
                      !conf.values[conf_item_value.depends_on].value
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
                />
              </div>
              <div
                v-if="conf_item_value.description || conf_item_value.help_link"
                class="configcolumnright"
              >
                <!-- right side of control: help icon with description-->
                <v-btn
                  icon="mdi-help-box"
                  variant="plain"
                  class="helpicon"
                  size="x-large"
                  @click="
                    conf_item_value.description
                      ? showHelpInfo = conf_item_value
                      : openLink(conf_item_value.help_link!)
                  "
                />
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
      <br>
      <v-btn
        block
        color="primary"
        @click="onSave"
      >
        {{ $t("settings.save") }}
      </v-btn>
    </v-form>
    <br>
    <v-btn
      block
      @click="$router.back()"
    >
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
            {{
              $t("read_more")
            }}
          </v-btn>
          <v-spacer />
          <v-btn
            color="primary"
            
            @click="showHelpInfo = undefined"
          >
            {{
              $t("close")
            }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { ref, VNodeRef } from "vue";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

import {
  ConfigEntryType,
  PlayerConfig,
  ProviderConfig,
  ConfigUpdate,
  ConfigValueType,
  ConfigEntryValue,
  SECURE_STRING_SUBSTITUTE,
} from "@/plugins/api/interfaces";

import { computed, watch } from "vue";

export interface Props {
  modelValue?: PlayerConfig | ProviderConfig;
  isBuiltin?: boolean;
}

const emit = defineEmits<{
  (e: "update:modelValue", value: ConfigUpdate): void;
}>();

// global refs
const conf = ref<ProviderConfig | PlayerConfig>();
const valid = ref(false);
const form = ref<VNodeRef>();
const activePanel = ref<string>("basic");
const showPasswordValues = ref(false);
const showHelpInfo = ref<ConfigEntryValue>();

// props
const props = defineProps<Props>();

// computed props
const hasAdvanced = computed(() => {
  if (!conf.value) return false;
  return (
    Object.values(conf.value.values).filter((x) => x.advanced && !x.hidden)
      .length > 0
  );
});
const panels = computed(() => {
  if (!hasAdvanced.value) return ["basic"];
  return ["basic", "advanced"];
});

// watchers
watch(
  () => props.modelValue,
  () => {
    conf.value = props.modelValue;
  },
  { immediate: true }
);

// methods
const validate = async function (this: any) {
  const { valid } = await (form.value as any).validate();
  return valid;
};
const onSave = async function (this: any) {
  if ((await validate()) && conf.value) {
    const updatedValues: Record<string, ConfigValueType> = {};
    for (const key in conf.value.values) {
      if (
        conf.value.values[key].type == ConfigEntryType.SECURE_STRING &&
        conf.value.values[key].value == SECURE_STRING_SUBSTITUTE
      ) {
        continue;
      }
      const value = conf.value.values[key].value;
      if (value !== undefined) {
        // TODO: only store actually updated values
        updatedValues[key] = value;
      }
    }

    const update: ConfigUpdate = {
      enabled: conf.value.enabled,
      name: conf.value.name,
      values: updatedValues,
    };

    emit("update:modelValue", update);
  }
};
const openLink = function (url: string) {
  window.open(url, "_blank");
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
  margin-right: -10px
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
