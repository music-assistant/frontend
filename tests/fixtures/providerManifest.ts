import {
  type ProviderManifest,
  ProviderStage,
  ProviderType,
} from "@/plugins/api/interfaces";

/**
 * A complete provider manifest, for tests that only care about a few of its
 * fields but should still model a payload the server can send.
 */
export function providerManifest(
  overrides: Partial<ProviderManifest> = {},
): ProviderManifest {
  return {
    type: ProviderType.MUSIC,
    domain: "test_provider",
    name: "Test provider",
    description: "",
    codeowners: [],
    credits: [],
    requirements: [],
    multi_instance: false,
    builtin: false,
    allow_disable: true,
    has_setup_flow: false,
    documentation: null,
    icon: null,
    depends_on: null,
    stage: ProviderStage.STABLE,
    icon_images: [],
    ...overrides,
  };
}
