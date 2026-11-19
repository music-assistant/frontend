import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import SettingsPageForm from "@/components/settings/SettingsPageForm.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  Scope,
  type ConfigEntry,
  type CoreConfig,
  type ServerInfoMessage,
} from "@/plugins/api/interfaces";
import NetworkSettings from "@/views/settings/NetworkSettings.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const { apiMock, hasScope } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    invokeCoreConfigAction:
      vi.fn<MusicAssistantApi["invokeCoreConfigAction"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    serverInfo: undefined as unknown as { value: ServerInfoMessage },
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

enableAutoUnmount(afterEach);

// the form and the URL card are covered where they live
const editConfigStub = {
  name: "EditConfig",
  props: { configEntries: Array, disabled: Boolean, inlineSave: Boolean },
  template: "<div data-testid='edit-config' />",
};
const resetUrlCard = vi.fn();
const serverUrlsCardStub = {
  name: "ServerUrlsCard",
  props: { baseUrl: Object, externalUrl: Object },
  emits: ["update:value"],
  setup(_: unknown, { expose }: { expose: (exposed: object) => void }) {
    expose({ reset: resetUrlCard });
  },
  template: "<div data-testid='server-urls' />",
};
const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.serverInfo = ref({ has_remote_access: true } as ServerInfoMessage);
  apiMock.getCoreConfig.mockImplementation(async (domain) =>
    networkConfig(domain),
  );
});

describe("NetworkSettings", () => {
  it("heads the page with the header of the network settings", async () => {
    const wrapper = await mountPage();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "network",
    );
  });

  it("leads to remote access, saying whether it is on", async () => {
    const wrapper = await mountPage();

    const link = wrapper.get('[data-testid="network-link-remote_access"]');
    expect(JSON.parse(link.attributes("href")!)).toEqual({
      name: "remoteaccesssettings",
    });
    expect(link.get('[data-testid="network-state"]').text()).toBe("on");
  });

  it("says when remote access is off", async () => {
    apiMock.serverInfo.value = {
      has_remote_access: false,
    } as ServerInfoMessage;

    const wrapper = await mountPage();

    expect(wrapper.get('[data-testid="network-state"]').text()).toBe("off");
  });

  it("leaves remote access out for a role that may not manage the system", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.SYSTEM_MANAGE);

    const wrapper = await mountPage();

    expect(
      wrapper.find('[data-testid="network-link-remote_access"]').exists(),
    ).toBe(false);
    expect(wrapper.find('[data-testid="edit-config"]').exists()).toBe(true);
  });

  it("shows the network settings of each module in one form, without their log levels", async () => {
    const wrapper = await mountPage();

    const entries = wrapper
      .getComponent(editConfigStub)
      .props("configEntries") as ConfigEntry[];
    expect(entries.map((entry) => entry.key)).toEqual([
      "core/webserver/server_name",
      "core/webserver/base_url",
      "core/webserver/external_url",
      "core/webserver/bind_port",
      "core/streams/bind_port",
      "core/discovery/upnp_network_scan",
    ]);
  });

  it.each([
    [
      "shows the self-registration with the web settings while it has no category of its own",
      "generic",
      true,
    ],
    [
      "leaves the self-registration to the user management once it has a category of its own",
      "account_access",
      false,
    ],
  ])("%s", async (_name, category, shown) => {
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      networkConfig(domain, category),
    );

    const wrapper = await mountPage();

    const keys = (
      wrapper
        .getComponent(editConfigStub)
        .props("configEntries") as ConfigEntry[]
    ).map((entry) => entry.key);
    expect(keys.includes("core/webserver/auth_allow_self_registration")).toBe(
      shown,
    );
  });

  it("edits the server URLs in a card of their own", async () => {
    const wrapper = await mountPage();
    const card = wrapper.getComponent(serverUrlsCardStub);

    expect((card.props("baseUrl") as ConfigEntry).key).toBe(
      "core/webserver/base_url",
    );
    expect((card.props("externalUrl") as ConfigEntry).key).toBe(
      "core/webserver/external_url",
    );

    await card.vm.$emit(
      "update:value",
      "core/webserver/external_url",
      "https://music.example.com",
    );

    const entries = wrapper
      .getComponent(editConfigStub)
      .props("configEntries") as ConfigEntry[];
    expect(
      entries.find((entry) => entry.key === "core/webserver/external_url"),
    ).toEqual(
      expect.objectContaining({
        hidden: true,
        value: "https://music.example.com",
      }),
    );
  });

  it("resets the URL card along with the form", async () => {
    const wrapper = await mountPage();

    await wrapper.getComponent(SettingsPageForm).vm.$emit("reset");

    expect(resetUrlCard).toHaveBeenCalledOnce();
  });
});

async function mountPage() {
  const wrapper = mount(NetworkSettings, {
    global: {
      stubs: {
        EditConfig: editConfigStub,
        ServerUrlsCard: serverUrlsCardStub,
        RouterLink: RouterLinkStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function networkConfig(
  domain: string,
  selfRegistrationCategory?: string,
): CoreConfig {
  const entry = (key: string, value: ConfigEntry["value"]): ConfigEntry => ({
    key,
    category: "generic",
    type: ConfigEntryType.STRING,
    label: key,
    default_value: null,
    required: false,
    options: [],
    value,
  });
  const values: Record<string, ConfigEntry[]> = {
    webserver: [
      entry("server_name", "Music Assistant"),
      entry("base_url", "auto"),
      entry("external_url", ""),
      entry("bind_port", 8095),
      ...(selfRegistrationCategory
        ? [
            {
              ...entry("auth_allow_self_registration", true),
              category: selfRegistrationCategory,
            },
          ]
        : []),
      entry("log_level", "GLOBAL"),
    ],
    streams: [
      entry("bind_port", 8097),
      { ...entry("fade_in", 1), category: "playback" },
    ],
    discovery: [
      entry("upnp_network_scan", false),
      entry("log_level", "GLOBAL"),
    ],
  };
  return {
    domain,
    last_error: null,
    values: Object.fromEntries(values[domain].map((e) => [e.key, e])),
  };
}
