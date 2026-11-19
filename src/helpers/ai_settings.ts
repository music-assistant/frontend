import type { SettingsRow } from "@/components/settings/SettingsLinkRows.vue";
import {
  AI_ENGINE_KINDS,
  enginesOf,
  providesAIEngines,
} from "@/helpers/ai_engines";
import { coreModuleName } from "@/helpers/core_modules";
import { getInstanceSettingsRoute } from "@/helpers/provider_catalog";
import { coreSettingsPageId } from "@/helpers/settings_pages";
import {
  providerOwnPage,
  settingsMenuPage,
  settingsPageRoute,
} from "@/helpers/settings_sections";
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
 * A row for each engine setting: what it belongs to, the kind of engine, the
 * engine it uses, and where it is changed.
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
  const engineNames = new Map(
    engines.map((engine) => [engine.uid, engine.name]),
  );
  return usage.map((setting) => {
    const engineName = setting.engine
      ? engineNames.get(setting.engine)
      : undefined;
    return {
      key: `${setting.owner}/${setting.key}`,
      icon: markRaw(ENGINE_KIND_ICONS[setting.kind]),
      label: ownerLabel(setting),
      description: $t(`settings.ai.kind.${setting.kind}`),
      state: engineState(setting, engineName),
      error: !engineName,
      ...settingDestination(setting, reconfigure),
    };
  });
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

function engineState(
  setting: AIEngineUsage,
  engineName: string | undefined,
): string {
  if (!engineName) return $t("settings.ai.not_available");
  return setting.follows_default
    ? $t("settings.ai.follows_default", { engine: engineName })
    : engineName;
}

function settingDestination(
  setting: AIEngineUsage,
  reconfigure: (setting: AIEngineUsage) => void,
): Pick<SettingsRow, "to" | "action"> {
  if (setting.owner_type === "core") {
    const pageId = coreSettingsPageId(setting.domain);
    return {
      to: pageId
        ? settingsPageRoute(pageId)
        : { name: "editcore", params: { domain: setting.domain } },
    };
  }
  if (setting.in_setup_data) return { action: () => reconfigure(setting) };
  return {
    to: getInstanceSettingsRoute({
      domain: setting.domain,
      instance_id: setting.owner,
    }),
  };
}
