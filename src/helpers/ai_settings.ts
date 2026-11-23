import type { SettingsRow } from "@/components/settings/SettingsLinkRows.vue";
import type { ConfigValueOwner } from "@/composables/useConfigValue";
import {
  AI_ENGINE_KINDS,
  enginesOf,
  providesAIEngines,
} from "@/helpers/ai_engines";
import { coreModuleName } from "@/helpers/core_modules";
import { getInstanceSettingsRoute } from "@/helpers/provider_catalog";
import { coreSettingsPageId } from "@/helpers/settings_pages";
import { providerOwnPage, settingsMenuPage } from "@/helpers/settings_sections";
import {
  type AIEngine,
  AIEngineKind,
  type AIEngineUsage,
  type ProviderInstance,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Image, MessageSquareText, Puzzle, Speech } from "@lucide/vue";
import { type Component, markRaw } from "vue";

const SUMMARY_SEPARATOR = " · ";

const ENGINE_KIND_ICONS: Readonly<Record<AIEngineKind, Component>> = {
  [AIEngineKind.TEXT]: MessageSquareText,
  [AIEngineKind.SPEECH]: Speech,
  [AIEngineKind.IMAGE]: Image,
};

/**
 * How many engines of each kind there are, such as "2 text · 1 image"; empty
 * without engines.
 *
 * @param engines - The engines to sum up.
 */
export function engineSummary(engines: readonly AIEngine[]): string {
  return AI_ENGINE_KINDS.map((kind) => {
    const count = engines.filter((engine) => engine.kind === kind).length;
    return count
      ? $t(`settings.ai.engine_count.${kind}`, count, { named: { count } })
      : "";
  })
    .filter(Boolean)
    .join(SUMMARY_SEPARATOR);
}

/**
 * A row for each engine setting, saying what it belongs to and the kind of
 * engine. A setting stored in the setup of its provider names its engine and
 * starts that setup; the engine of any other setting is picked on its row,
 * see hasEnginePicker. A setting without engines of its kind says so.
 *
 * @param usage - The engine settings of the core modules and providers.
 * @param engines - The available engines.
 * @param reconfigure - Starts the setup flow of the provider of a setting that
 *   is changed there.
 */
export function engineUsageRows(
  usage: readonly AIEngineUsage[],
  engines: readonly AIEngine[],
  reconfigure: (setting: AIEngineUsage) => void,
): SettingsRow[] {
  return usage.map((setting) => {
    const row: SettingsRow = {
      key: engineSettingKey(setting),
      icon: markRaw(ENGINE_KIND_ICONS[setting.kind]),
      label: ownerLabel(setting),
      description: $t(`settings.ai.kind.${setting.kind}`),
      ...(setting.in_setup_data && { action: () => reconfigure(setting) }),
    };
    const engineName = engineNameOf(setting, engines);
    if (!engines.some((engine) => engine.kind === setting.kind)) {
      return { ...row, state: $t("settings.ai.not_available") };
    }
    if (setting.in_setup_data) {
      return {
        ...row,
        state: engineSettingState(setting, engines),
        error: !engineName,
      };
    }
    // the picker on the row names the kind of engine itself
    return { ...row, description: "" };
  });
}

/**
 * Whether the engine of a setting is picked on its row: the setting is not
 * stored in the setup of its provider, and there are engines of its kind.
 *
 * @param setting - The engine setting.
 * @param engines - The available engines.
 */
export function hasEnginePicker(
  setting: AIEngineUsage,
  engines: readonly AIEngine[],
): boolean {
  return (
    !setting.in_setup_data &&
    engines.some((engine) => engine.kind === setting.kind)
  );
}

/**
 * Whether the engine a setting selects is one of the available engines.
 *
 * @param setting - The engine setting.
 * @param engines - The available engines.
 */
export function selectsAvailableEngine(
  setting: AIEngineUsage,
  engines: readonly AIEngine[],
): boolean {
  return engineNameOf(setting, engines) !== undefined;
}

/**
 * The engine a setting uses, as its row states it: the engine, the default
 * engine it follows, or that its engine is not available.
 *
 * @param setting - The engine setting.
 * @param engines - The available engines.
 */
export function engineSettingState(
  setting: AIEngineUsage,
  engines: readonly AIEngine[],
): string {
  const engineName = engineNameOf(setting, engines);
  if (!engineName) return $t("settings.ai.not_available");
  return setting.follows_default
    ? $t("settings.ai.follows_default", { engine: engineName })
    : engineName;
}

/**
 * The key of an engine setting among those of every owner, as its row has it.
 *
 * @param setting - The engine setting.
 */
export function engineSettingKey(setting: AIEngineUsage): string {
  return `${setting.owner}/${setting.key}`;
}

/**
 * The core module or provider instance storing an engine setting.
 *
 * @param setting - The engine setting.
 */
export function engineSettingOwner(setting: AIEngineUsage): ConfigValueOwner {
  return setting.owner_type === "core"
    ? { kind: "core", domain: setting.owner }
    : { kind: "provider", domain: setting.domain, instanceId: setting.owner };
}

/**
 * The engine settings to list: the current ones, and the ones listed before of
 * each restarting provider, which the server leaves out until the provider is
 * loaded again. Those keep their place: the core modules first, then the
 * providers by name, as the server lists them.
 *
 * @param current - The engine settings the server lists now.
 * @param previous - The engine settings listed before.
 * @param restarting - The instance ids of the restarting providers.
 */
export function withRestartingSettings(
  current: readonly AIEngineUsage[],
  previous: readonly AIEngineUsage[],
  restarting: ReadonlySet<string>,
): AIEngineUsage[] {
  const listed = new Set(current.map(({ owner }) => owner));
  const kept = previous.filter(
    ({ owner }) => restarting.has(owner) && !listed.has(owner),
  );
  if (kept.length === 0) return [...current];
  return [...current, ...kept].sort(byListOrder);
}

/**
 * A row for each running plugin that provides engines, saying how many of each
 * kind it provides and leading to its page. A plugin that provides none yet
 * asks for its models to be chosen.
 *
 * @param providers - The running provider instances.
 * @param engines - The available engines.
 */
export function aiServiceRows(
  providers: readonly ProviderInstance[],
  engines: readonly AIEngine[],
): SettingsRow[] {
  return providers
    .filter((provider) => providesAIEngines(provider))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((provider) => {
      const summary = engineSummary(enginesOf(engines, provider.instance_id));
      return {
        key: provider.instance_id,
        icon: markRaw(providerOwnPage(provider.domain)?.icon ?? Puzzle),
        label: provider.name,
        description: summary || $t("settings.ai.choose_models"),
        error: !summary,
        to: getInstanceSettingsRoute(provider),
      };
    });
}

// a core module is named after the settings page showing its settings
function ownerLabel(setting: AIEngineUsage): string {
  if (setting.owner_type === "provider") return setting.name;
  const page = settingsMenuPage(coreSettingsPageId(setting.domain));
  return page
    ? $t(page.label)
    : coreModuleName(setting.domain, (key) => $t(key), setting.name);
}

// the name of the available engine a setting selects, if any
function engineNameOf(
  setting: AIEngineUsage,
  engines: readonly AIEngine[],
): string | undefined {
  return engines.find((engine) => engine.uid === setting.engine)?.name;
}

// the core modules in the order the server has them, then the providers by
// their case folded name
function byListOrder(a: AIEngineUsage, b: AIEngineUsage): number {
  if (a.owner_type !== b.owner_type) return a.owner_type === "core" ? -1 : 1;
  if (a.owner_type === "core") return 0;
  const nameA = a.name.toLowerCase();
  const nameB = b.name.toLowerCase();
  return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
}
