import ServerOutdated from "@/components/ServerOutdated.vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  api: { serverInfo: { value: { server_version: "2.10.4" } } },
}));

function mountScreen() {
  return mount(ServerOutdated, {
    global: {
      mocks: {
        $t: (key: string, params?: Record<string, unknown>) =>
          params ? `${key} ${JSON.stringify(params)}` : key,
      },
    },
  });
}

describe("ServerOutdated", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the server version that needs an update", () => {
    const wrapper = mountScreen();

    expect(wrapper.text()).toContain("login.server_outdated_title");
    expect(wrapper.text()).toContain(
      'login.server_outdated_message {"version":"2.10.4"}',
    );
    wrapper.unmount();
  });

  it("reloads the app to try again", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const wrapper = mountScreen();

    await wrapper.get("button").trigger("click");

    expect(reload).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});
