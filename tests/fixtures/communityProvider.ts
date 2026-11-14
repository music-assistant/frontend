import {
  type CommunityProvider,
  CommunityProviderState,
  ProviderTier,
} from "@/plugins/api/interfaces";
import { providerManifest } from "./providerManifest";

// an svg as the server encodes it
export const COMMUNITY_ICON = "data:image/svg+xml;base64,PHN2Zy8+";

/**
 * A provider of the community catalog that can be installed, for tests that
 * only care about a few of its fields.
 */
export function communityProvider(
  domain: string,
  overrides: Partial<CommunityProvider> = {},
): CommunityProvider {
  return {
    domain,
    repository: `jane/${domain}`,
    maintainers: ["@jane"],
    icon: COMMUNITY_ICON,
    manifest: providerManifest({
      domain,
      name: domain,
      codeowners: ["@jane"],
      tier: ProviderTier.COMMUNITY,
    }),
    state: CommunityProviderState.AVAILABLE,
    installed_version: null,
    latest_version: "1.2.0",
    added: "2026-10-01T00:00:00Z",
    released: "2026-11-02T00:00:00Z",
    reason: null,
    reason_url: null,
    error: null,
    notice: null,
    ...overrides,
  };
}
