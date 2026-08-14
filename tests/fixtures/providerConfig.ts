import { type ProviderConfig, ProviderType } from "@/plugins/api/interfaces";

/**
 * A complete provider config, for tests that only care about a few of its
 * fields but should still model a payload the server can send.
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
    enabled: true,
    name: null,
    default_name: null,
    last_error: null,
    status: null,
    values: {},
    ...overrides,
  };
}
