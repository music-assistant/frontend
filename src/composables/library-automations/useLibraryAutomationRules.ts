import api from "@/plugins/api";
import type {
  LibraryAutomationAction,
  LibraryAutomationCondition,
  LibraryAutomationRule,
  LibraryAutomationTrigger,
  LibraryAutomationTypeInfo,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";

export interface LibraryAutomationRulePayload {
  name: string;
  trigger: LibraryAutomationTrigger;
  action: LibraryAutomationAction;
  conditions?: LibraryAutomationCondition[];
  condition_logic?: "AND" | "OR";
  enabled?: boolean;
}

const rules = ref<LibraryAutomationRule[]>([]);
const triggerTypes = ref<LibraryAutomationTypeInfo[]>([]);
const actionTypes = ref<LibraryAutomationTypeInfo[]>([]);

const loadingRules = ref(false);
const loadingTypes = ref(false);
const savingRule = ref(false);
// Rule id currently being deleted, so only that row reflects it.
const deletingRuleId = ref("");

async function loadRules(): Promise<LibraryAutomationRule[]> {
  loadingRules.value = true;
  try {
    const result = await api.sendCommand<LibraryAutomationRule[]>(
      "library_automations/list_rules",
    );
    rules.value = result || [];
    return rules.value;
  } finally {
    loadingRules.value = false;
  }
}

async function loadTypes(): Promise<void> {
  loadingTypes.value = true;
  try {
    const [triggers, actions] = await Promise.all([
      api.sendCommand<LibraryAutomationTypeInfo[]>(
        "library_automations/list_trigger_types",
      ),
      api.sendCommand<LibraryAutomationTypeInfo[]>(
        "library_automations/list_action_types",
      ),
    ]);
    triggerTypes.value = triggers || [];
    actionTypes.value = actions || [];
  } finally {
    loadingTypes.value = false;
  }
}

async function createRule(
  payload: LibraryAutomationRulePayload,
): Promise<LibraryAutomationRule> {
  savingRule.value = true;
  try {
    const created = await api.sendCommand<LibraryAutomationRule>(
      "library_automations/create_rule",
      { ...payload },
    );
    toast.success($t("providers.library_automations.toast.rule_saved"));
    await loadRules();
    return created;
  } finally {
    savingRule.value = false;
  }
}

async function updateRule(
  ruleId: string,
  payload: LibraryAutomationRulePayload,
): Promise<LibraryAutomationRule> {
  savingRule.value = true;
  try {
    const updated = await api.sendCommand<LibraryAutomationRule>(
      "library_automations/update_rule",
      { rule_id: ruleId, ...payload },
    );
    toast.success($t("providers.library_automations.toast.rule_saved"));
    await loadRules();
    return updated;
  } finally {
    savingRule.value = false;
  }
}

async function deleteRule(ruleId: string): Promise<void> {
  deletingRuleId.value = ruleId;
  try {
    await api.sendCommand("library_automations/delete_rule", {
      rule_id: ruleId,
    });
    toast.success($t("providers.library_automations.toast.rule_deleted"));
    await loadRules();
  } finally {
    deletingRuleId.value = "";
  }
}

async function setRuleEnabled(ruleId: string, enabled: boolean): Promise<void> {
  await api.sendCommand("library_automations/set_rule_enabled", {
    rule_id: ruleId,
    enabled,
  });
  const rule = rules.value.find((r) => r.id === ruleId);
  if (rule) rule.enabled = enabled;
  toast.success(
    $t(
      enabled
        ? "providers.library_automations.toast.rule_enabled"
        : "providers.library_automations.toast.rule_disabled",
    ),
  );
}

export function useLibraryAutomationRules() {
  return {
    rules,
    triggerTypes,
    actionTypes,
    loadingRules,
    loadingTypes,
    savingRule,
    deletingRuleId,
    loadRules,
    loadTypes,
    createRule,
    updateRule,
    deleteRule,
    setRuleEnabled,
  };
}
