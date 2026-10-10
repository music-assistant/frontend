import UnsupportedInstallBanner from "@/components/UnsupportedInstallBanner.vue";
import type { ServerInfoMessage } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ref } from "vue";
import { createI18n } from "vue-i18n";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    // replaced with a real ref by the api mock factory below
    serverInfo: { value: undefined } as Ref<ServerInfoMessage | undefined>,
  },
}));

vi.mock("@/plugins/api", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.serverInfo = ref<ServerInfoMessage | undefined>(undefined);
  return { api: apiMock, default: apiMock };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

function serverInfo(unsupported_install?: boolean): ServerInfoMessage {
  return { server_id: "server-1", unsupported_install } as ServerInfoMessage;
}

function mountBanner() {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    messages: {
      en: {
        settings: { unsupported_install_description: "Not one of the {0}." },
      },
    },
  });
  return mount(UnsupportedInstallBanner, { global: { plugins: [i18n] } });
}

describe("UnsupportedInstallBanner", () => {
  it("shows the banner on an unsupported installation", () => {
    apiMock.serverInfo.value = serverInfo(true);

    const wrapper = mountBanner();

    expect(wrapper.text()).toContain("settings.unsupported_install_title");
    // the docs link sits inside the sentence
    expect(wrapper.get("p").text()).toBe(
      "Not one of the settings.unsupported_install_link.",
    );
    expect(wrapper.get("p a").attributes("href")).toBe(
      "https://music-assistant.io/installation/",
    );
  });

  it.each([serverInfo(false), serverInfo(undefined), undefined])(
    "stays hidden for server info %o",
    (info) => {
      apiMock.serverInfo.value = info;

      const wrapper = mountBanner();

      expect(wrapper.text()).toBe("");
    },
  );
});
