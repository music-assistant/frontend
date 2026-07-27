import { flushPromises, shallowMount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigEntryType,
  EventType,
  ProviderStage,
  ProviderStatus,
  ProviderType,
  type ProviderConfig,
} from "@/plugins/api/interfaces";
import EditProvider from "@/views/settings/EditProvider.vue";

const { apiMock, eventbusMock, routerMock, unsubscribeMock } = vi.hoisted(
  () => ({
    apiMock: {
      getProvider: vi.fn(),
      getProviderConfig: vi.fn(),
      invokeProviderConfigAction: vi.fn(),
      providerManifests: {
        spotify: {
          codeowners: [],
          credits: [],
          description: "Spotify music provider",
          has_setup_flow: true,
          name: "Spotify",
        },
      },
      providers: {},
      reloadProvider: vi.fn(),
      removeProviderConfig: vi.fn(),
      saveProviderConfig: vi.fn(),
      subscribe: vi.fn(),
    },
    eventbusMock: {
      emit: vi.fn(),
    },
    routerMock: {
      push: vi.fn(),
    },
    unsubscribeMock: vi.fn(),
  }),
);

let providersUpdated: (() => void) | undefined;

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: eventbusMock,
}));

vi.mock("@/helpers/utils", () => ({
  markdownToHtml: (value: string) => value,
  openActionUrlEntries: <T>(entries: T) => entries,
}));

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: () => routerMock,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  providersUpdated = undefined;
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.subscribe.mockImplementation(
    (event: EventType, callback: () => void) => {
      if (event === EventType.PROVIDERS_UPDATED) {
        providersUpdated = callback;
      }
      return unsubscribeMock;
    },
  );
});

describe("EditProvider", () => {
  it("refreshes provider state after a provider update", async () => {
    apiMock.getProviderConfig
      .mockResolvedValueOnce(
        providerConfig(ProviderStatus.AUTH_REQUIRED, "current value"),
      )
      .mockResolvedValueOnce(
        providerConfig(ProviderStatus.LOADED, "server refresh"),
      );

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("settings.provider_requires_attention");

    providersUpdated?.();
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain(
      "settings.provider_requires_attention",
    );
    expect(
      wrapper.findComponent({ name: "EditConfig" }).props("configEntries"),
    ).toEqual([
      expect.objectContaining({
        key: "account",
        value: "current value",
      }),
    ]);

    wrapper.unmount();
    expect(unsubscribeMock).toHaveBeenCalledOnce();
  });

  it("refreshes provider status when reconfiguration ends", async () => {
    apiMock.getProviderConfig
      .mockResolvedValueOnce(providerConfig(ProviderStatus.AUTH_REQUIRED))
      .mockResolvedValueOnce(providerConfig(ProviderStatus.LOADED));

    const wrapper = shallowMount(EditProvider, {
      props: {
        instanceId: "spotify--test",
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    await flushPromises();

    await wrapper.get("button-stub").trigger("click");

    const setupFlowCall = eventbusMock.emit.mock.calls.find(
      ([event]) => event === "setupFlowDialog",
    );
    setupFlowCall?.[1].onFlowEnded();
    await flushPromises();

    expect(apiMock.getProviderConfig).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain(
      "settings.provider_requires_attention",
    );
  });
});

function providerConfig(
  status: ProviderStatus,
  account: string = "current value",
): ProviderConfig {
  return {
    domain: "spotify",
    enabled: true,
    instance_id: "spotify--test",
    last_error:
      status === ProviderStatus.AUTH_REQUIRED
        ? {
            error_code: 1,
            message: "Authentication required",
          }
        : undefined,
    manifest: {
      allow_disable: true,
      builtin: false,
      codeowners: [],
      credits: [],
      description: "Spotify music provider",
      domain: "spotify",
      icon_images: [],
      has_setup_flow: true,
      multi_instance: true,
      name: "Spotify",
      requirements: [],
      stage: ProviderStage.STABLE,
      type: ProviderType.MUSIC,
    },
    name: "Spotify",
    status,
    type: ProviderType.MUSIC,
    values: {
      account: {
        category: "generic",
        default_value: null,
        key: "account",
        label: "Account",
        required: false,
        type: ConfigEntryType.STRING,
        value: account,
      },
    },
  };
}
