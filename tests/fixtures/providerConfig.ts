import { type ProviderConfig, ProviderType } from "@/plugins/api/interfaces";
import { providerManifest } from "./providerManifest";

/**
 * A complete provider config, for tests that only care about a few of its
 * fields but should still model a payload the server can send. The default
 * manifest follows the config's own type and domain; pass `manifest` to
 * control the rest of it.
 */
export function providerConfig(
  overrides: Partial<ProviderConfig> = {},
): ProviderConfig {
  const type = overrides.type ?? ProviderType.MUSIC;
  const domain = overrides.domain ?? "test_provider";
  return {
    type,
    domain,
    instance_id: `${domain}--1`,
    manifest: providerManifest({ type, domain }),
    enabled: true,
    name: null,
    default_name: null,
    last_error: null,
    status: null,
    values: {},
    ...overrides,
  };
}
