import UnsupportedInstallBanner from "@/components/UnsupportedInstallBanner.vue";
import type { ServerInfoMessage } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Ref } from "vue";

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

describe("UnsupportedInstallBanner", () => {
  it("shows the banner on an unsupported installation", () => {
    apiMock.serverInfo.value = serverInfo(true);

    const wrapper = mount(UnsupportedInstallBanner);

    expect(wrapper.text()).toContain("settings.unsupported_install_title");
    expect(wrapper.get("a").attributes("href")).toBe(
      "https://music-assistant.io/installation/",
    );
  });

  it.each([false, undefined])(
    "stays hidden when unsupported_install is %s",
    (unsupported_install) => {
      apiMock.serverInfo.value = serverInfo(unsupported_install);

      const wrapper = mount(UnsupportedInstallBanner);

      expect(wrapper.text()).toBe("");
    },
  );
});
