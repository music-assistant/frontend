import { type ProviderInstance, ProviderType } from "@/plugins/api/interfaces";

/**
 * A complete provider instance, for tests that only care about a few of its
 * fields but should still model a payload the server can send.
 */
export function providerInstance(
  overrides: Partial<ProviderInstance> = {},
): ProviderInstance {
  const type = overrides.type ?? ProviderType.MUSIC;
  const domain = overrides.domain ?? "test_provider";
  return {
    type,
    domain,
    name: domain,
    instance_id: `${domain}--1`,
    supported_features: [],
    available: true,
    // only a music provider tells whether it streams
    is_streaming_provider: type === ProviderType.MUSIC ? false : null,
    ...overrides,
  };
}
