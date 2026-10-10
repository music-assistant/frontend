import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  type ConfigEntry,
  type RemoteAccessInfo,
  type ServerInfoMessage,
} from "@/plugins/api/interfaces";
import ServerUrlsCard from "@/views/settings/ServerUrlsCard.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reactive, type Ref } from "vue";

const { apiMock, copyMock, hasScope, toastMock } = vi.hoisted(() => ({
  apiMock: {
    configureRemoteAccess: vi.fn<MusicAssistantApi["configureRemoteAccess"]>(),
    getRemoteAccessInfo: vi.fn<MusicAssistantApi["getRemoteAccessInfo"]>(),
    // replaced with a real ref by the api mock factory below
    serverInfo: { value: undefined } as Ref<ServerInfoMessage | undefined>,
  },
  copyMock: vi.fn<(text: string) => Promise<boolean>>(),
  hasScope: vi.fn<(scope: string) => boolean>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.serverInfo = ref<ServerInfoMessage | undefined>(undefined);
  return { api: apiMock, default: apiMock };
});

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("vue-sonner", () => ({ toast: toastMock }));

vi.mock("@/helpers/utils", () => ({ copyToClipboard: copyMock }));

const REMOTE_ID = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const REMOTE_URL = `https://app.music-assistant.io/?remote_id=${REMOTE_ID}`;
const DETECTED_URL = "http://192.168.1.10:8095";

const RouterLinkStub = {
  name: "RouterLink",
  props: ["to"],
  template: '<a :data-route="to.name"><slot /></a>',
};

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.serverInfo.value = serverInfo(true);
  apiMock.getRemoteAccessInfo.mockResolvedValue(remoteAccessInfo());
  copyMock.mockResolvedValue(true);
  hasScope.mockReturnValue(true);
});

describe("ServerUrlsCard", () => {
  describe("internet", () => {
    it("uses remote access while the external URL is empty", async () => {
      const { wrapper } = await mountCard({ external_url: null });

      expect(remoteSwitch(wrapper).attributes("data-state")).toBe("checked");
      expect(wrapper.find(REMOTE_LINK).text()).toContain(REMOTE_URL);
      expect(wrapper.find(EXTERNAL_INPUT).exists()).toBe(false);
    });

    it("shows the external URL when one is set", async () => {
      const { wrapper } = await mountCard({
        external_url: "https://music.example.com",
      });

      expect(remoteSwitch(wrapper).attributes("data-state")).toBe("unchecked");
      expect(externalInput(wrapper).element.value).toBe(
        "https://music.example.com",
      );
      expect(wrapper.find(REMOTE_LINK).exists()).toBe(false);
      // remote access is on already, so there is nothing to point to
      expect(wrapper.find(REMOTE_HINT).exists()).toBe(false);
    });

    it("clears the external URL for remote access and gives it back when switched off", async () => {
      const { wrapper, values } = await mountCard({
        external_url: "https://music.example.com",
      });

      await remoteSwitch(wrapper).trigger("click");

      expect(values.external_url).toBe("");
      expect(wrapper.find(REMOTE_LINK).exists()).toBe(true);

      await remoteSwitch(wrapper).trigger("click");

      expect(values.external_url).toBe("https://music.example.com");
      expect(externalInput(wrapper).element.value).toBe(
        "https://music.example.com",
      );
      // the switch only picks the URL; remote access itself stays as it is
      expect(apiMock.configureRemoteAccess).not.toHaveBeenCalled();
    });

    it("keeps the input open while an external URL is typed in", async () => {
      const { wrapper, values } = await mountCard({ external_url: null });

      await remoteSwitch(wrapper).trigger("click");

      expect(remoteSwitch(wrapper).attributes("data-state")).toBe("unchecked");
      expect(values.external_url).toBeNull();

      await externalInput(wrapper).setValue("https://music.example.com");
      expect(values.external_url).toBe("https://music.example.com");
      // clearing it again does not take the input away
      await externalInput(wrapper).setValue("");
      expect(values.external_url).toBe("");
      expect(externalInput(wrapper).exists()).toBe(true);
      expect(apiMock.configureRemoteAccess).not.toHaveBeenCalled();
    });

    it("keeps the input open while a set external URL is emptied", async () => {
      const { wrapper, values } = await mountCard({
        external_url: "https://music.example.com",
      });

      await externalInput(wrapper).setValue("");

      expect(values.external_url).toBe("");
      expect(remoteSwitch(wrapper).attributes("data-state")).toBe("unchecked");
      expect(externalInput(wrapper).exists()).toBe(true);
    });

    it("offers no switch, but a hint, while remote access is off", async () => {
      apiMock.serverInfo.value = serverInfo(false);

      const { wrapper } = await mountCard({ external_url: null });

      expect(remoteSwitch(wrapper).exists()).toBe(false);
      expect(externalInput(wrapper).exists()).toBe(true);
      expect(wrapper.find(REMOTE_HINT).text()).toContain(
        "settings.server_url.remote_access_hint",
      );
      expect(
        wrapper
          .find(`${REMOTE_HINT} [data-route=remoteaccesssettings]`)
          .exists(),
      ).toBe(true);
      // the link is only worth asking for once remote access is on
      expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
    });

    it("leaves out the link to remote access for a user who cannot open it", async () => {
      apiMock.serverInfo.value = serverInfo(false);
      hasScope.mockReturnValue(false);

      const { wrapper } = await mountCard({ external_url: null });

      expect(wrapper.find(REMOTE_HINT).exists()).toBe(true);
      expect(wrapper.find("[data-route=remoteaccesssettings]").exists()).toBe(
        false,
      );
    });

    it("does not read the remote access link without the system scope", async () => {
      hasScope.mockReturnValue(false);

      const { wrapper } = await mountCard({ external_url: null });

      expect(hasScope).toHaveBeenCalledWith("system.manage");
      expect(remoteSwitch(wrapper).exists()).toBe(false);
      expect(externalInput(wrapper).exists()).toBe(true);
      expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
    });

    it("copies the remote access link", async () => {
      const { wrapper } = await mountCard({ external_url: null });

      await wrapper
        .find("[data-testid=server-urls-remote-copy]")
        .trigger("click");
      await flushPromises();

      expect(copyMock).toHaveBeenCalledWith(REMOTE_URL);
      expect(toastMock.success).toHaveBeenCalledWith(
        "settings.server_url.copied",
      );
    });

    it("leaves the section out on a server without an external URL", async () => {
      const { wrapper } = await mountCard({}, { withExternalUrl: false });

      expect(wrapper.find("[data-testid=server-urls-internet]").exists()).toBe(
        false,
      );
      expect(wrapper.find("[data-testid=server-urls-local]").exists()).toBe(
        true,
      );
    });
  });

  describe("local network", () => {
    it("shows the detected URL while the stored value is auto", async () => {
      const { wrapper } = await mountCard({ base_url: "auto" });

      expect(automaticSwitch(wrapper).attributes("data-state")).toBe("checked");
      expect(wrapper.find(DETECTED).text()).toContain(DETECTED_URL);
      expect(wrapper.find(INTERNAL_INPUT).exists()).toBe(false);

      await wrapper
        .find("[data-testid=server-urls-detected-copy]")
        .trigger("click");
      await flushPromises();

      expect(copyMock).toHaveBeenCalledWith(DETECTED_URL);
    });

    it("prefills the detected URL when switched off", async () => {
      const { wrapper, values } = await mountCard({ base_url: "auto" });

      await automaticSwitch(wrapper).trigger("click");

      expect(values.base_url).toBe(DETECTED_URL);
      expect(internalInput(wrapper).element.value).toBe(DETECTED_URL);

      await automaticSwitch(wrapper).trigger("click");

      expect(values.base_url).toBe("auto");
    });

    it("shows a custom URL, and waits for a save to detect one", async () => {
      const { wrapper, values } = await mountCard({
        base_url: "https://ma.lan",
      });

      expect(automaticSwitch(wrapper).attributes("data-state")).toBe(
        "unchecked",
      );
      expect(internalInput(wrapper).element.value).toBe("https://ma.lan");

      await automaticSwitch(wrapper).trigger("click");

      expect(values.base_url).toBe("auto");
      // the URL the server reports is the custom one until this is saved
      expect(wrapper.find(DETECTED).text()).toContain(
        "settings.server_url.detected_after_save",
      );
      expect(wrapper.find(DETECTED).text()).not.toContain(DETECTED_URL);

      await automaticSwitch(wrapper).trigger("click");

      expect(values.base_url).toBe("https://ma.lan");
    });

    it("writes what is typed as the internal URL", async () => {
      const { wrapper, values } = await mountCard({
        base_url: "https://ma.lan",
      });

      await internalInput(wrapper).setValue("https://music.lan:8095");

      expect(values.base_url).toBe("https://music.lan:8095");
    });
  });
});

const REMOTE_LINK = "[data-testid=server-urls-remote-link]";
const REMOTE_HINT = "[data-testid=server-urls-remote-hint]";
const EXTERNAL_INPUT = "[data-testid=server-urls-external-input]";
const INTERNAL_INPUT = "[data-testid=server-urls-internal-input]";
const DETECTED = "[data-testid=server-urls-detected]";

/**
 * Mounts the card on entries holding `values`, applying what it reports the
 * way the settings page does.
 */
async function mountCard(
  values: { base_url?: string; external_url?: string | null } = {},
  { withExternalUrl = true } = {},
) {
  const entries = reactive({
    base_url: entry("base_url", values.base_url ?? "auto", "auto"),
    external_url: entry("external_url", values.external_url ?? null, null),
  });
  const wrapper = mount(ServerUrlsCard, {
    props: {
      baseUrl: entries.base_url,
      externalUrl: withExternalUrl ? entries.external_url : undefined,
      "onUpdate:value": (key: string, value: string) => {
        entries[key as keyof typeof entries].value = value;
      },
    },
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
  await flushPromises();
  return {
    wrapper,
    values: {
      get base_url() {
        return entries.base_url.value;
      },
      get external_url() {
        return entries.external_url.value;
      },
    },
  };
}

type Wrapper = Awaited<ReturnType<typeof mountCard>>["wrapper"];

function remoteSwitch(wrapper: Wrapper) {
  return wrapper.find("[data-testid=server-urls-remote-switch]");
}

function automaticSwitch(wrapper: Wrapper) {
  return wrapper.find("[data-testid=server-urls-automatic-switch]");
}

function externalInput(wrapper: Wrapper) {
  return wrapper.find<HTMLInputElement>(EXTERNAL_INPUT);
}

function internalInput(wrapper: Wrapper) {
  return wrapper.find<HTMLInputElement>(INTERNAL_INPUT);
}

function entry(
  key: string,
  value: string | null,
  defaultValue: string | null,
): ConfigEntry {
  return {
    key,
    type: ConfigEntryType.STRING,
    label: key,
    description: `${key} description`,
    category: "generic",
    default_value: defaultValue,
    required: false,
    options: [],
    advanced: true,
    value,
  };
}

function serverInfo(has_remote_access: boolean): ServerInfoMessage {
  return {
    server_id: "server-1",
    internal_url: DETECTED_URL,
    has_remote_access,
  } as ServerInfoMessage;
}

function remoteAccessInfo(): RemoteAccessInfo {
  return {
    enabled: true,
    running: true,
    connected: true,
    remote_id: REMOTE_ID,
    using_ha_cloud: false,
    signaling_url: "wss://signaling.example",
  };
}
