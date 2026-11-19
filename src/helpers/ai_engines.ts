import {
  type AIEngine,
  AIEngineKind,
  ProviderFeature,
  type ProviderInstance,
  ProviderType,
} from "@/plugins/api/interfaces";

/** The domain of the MCP server built into Music Assistant, through which AI assistants use it. */
export const MCP_SERVER_DOMAIN = "mcp_server";

/** The kinds of engine, in the order they are named. */
export const AI_ENGINE_KINDS: readonly AIEngineKind[] = [
  AIEngineKind.TEXT,
  AIEngineKind.SPEECH,
  AIEngineKind.IMAGE,
];

// a plugin with one of these features provides engines
const ENGINE_FEATURES: readonly ProviderFeature[] = [
  ProviderFeature.AI_QUERY,
  ProviderFeature.TTS,
];

/**
 * Whether a provider instance is a running plugin that provides AI engines.
 *
 * @param provider - The provider instance.
 */
export function providesAIEngines(
  provider: Pick<ProviderInstance, "type" | "available" | "supported_features">,
): boolean {
  return (
    provider.type === ProviderType.PLUGIN &&
    provider.available &&
    ENGINE_FEATURES.some((feature) =>
      provider.supported_features.includes(feature),
    )
  );
}

/**
 * The engines a plugin instance provides.
 *
 * @param engines - The available engines.
 * @param instanceId - The instance id of the plugin.
 */
export function enginesOf(
  engines: readonly AIEngine[],
  instanceId: string,
): AIEngine[] {
  return engines.filter((engine) => engine.provider === instanceId);
}
