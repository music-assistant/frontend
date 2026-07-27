import { ProviderStatus } from "@/plugins/api/interfaces";

export const canReconfigureProvider = (
  status?: ProviderStatus,
  hasSetupFlow?: boolean,
  enabled: boolean = true,
) => enabled && hasSetupFlow === true && status !== ProviderStatus.INCOMPATIBLE;

export const providerRequiresReconfiguration = (
  status?: ProviderStatus,
  hasSetupFlow?: boolean,
  enabled: boolean = true,
) =>
  status === ProviderStatus.AUTH_REQUIRED &&
  canReconfigureProvider(status, hasSetupFlow, enabled);
