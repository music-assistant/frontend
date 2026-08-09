import HostCard from "@/components/ai-radio/HostCard.vue";
import { useHosts } from "@/composables/ai-radio/useHosts";
import type { AIRadioHost } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn(async () => []),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    // useHosts derives ai_radio availability from the provider list.
    providers: {},
    sendCommand,
  },
}));

let onConfirm: (() => Promise<void> | void) | undefined;

vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    emit: (
      _event: string,
      payload: { onConfirm: () => Promise<void> | void },
    ) => {
      onConfirm = payload.onConfirm;
    },
  },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const host: AIRadioHost = {
  id: "morning_crew",
  name: "Morning Crew",
  instructions: "Be upbeat.",
  tts_engine: "",
  section_ids: [],
  section_order: [],
  merge_section_id: "morning_crew_smoother",
};

const passthroughStub = { template: "<div><slot /></div>" };
// The real content renders through a Teleport/portal, so its clicks never
// reach the card's root click handler; stopping propagation here matches that.
const contentStub = { template: "<div @click.stop><slot /></div>" };

function mountCard() {
  return mount(HostCard, {
    props: { host },
    global: {
      stubs: {
        DropdownMenu: passthroughStub,
        DropdownMenuContent: contentStub,
        DropdownMenuTrigger: passthroughStub,
        DropdownMenuSeparator: true,
        DropdownMenuItem: {
          props: ["disabled", "variant"],
          emits: ["click"],
          template:
            '<button v-bind="$attrs" :disabled="disabled" :data-variant="variant" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  });
}

afterEach(async () => {
  const { toast } = await import("vue-sonner");
  vi.clearAllMocks();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  onConfirm = undefined;
  useHosts().deletingHostId.value = "";
});

describe("HostCard", () => {
  it("renders the host name", () => {
    const wrapper = mountCard();

    expect(wrapper.text()).toContain("Morning Crew");
  });

  it("emits edit with the host id when the card is clicked", async () => {
    const wrapper = mountCard();

    await wrapper.find(".host-card").trigger("click");

    expect(wrapper.emitted("edit")).toEqual([["morning_crew"]]);
  });

  it("emits edit when the menu's Edit item is clicked", async () => {
    const wrapper = mountCard();

    await wrapper.findAll("button")[1].trigger("click");

    expect(wrapper.emitted("edit")).toEqual([["morning_crew"]]);
  });

  it("deletes the host once the confirmation dialog is confirmed", async () => {
    const wrapper = mountCard();

    await wrapper.findAll("button")[2].trigger("click");
    await onConfirm?.();

    expect(sendCommand).toHaveBeenCalledWith("ai_radio/hosts/delete", {
      host_id: "morning_crew",
    });
  });

  it("surfaces a delete error from the server's in-use guard via toast", async () => {
    sendCommand.mockRejectedValueOnce(new Error("Host is used by 1 station"));
    const { toast } = await import("vue-sonner");
    const wrapper = mountCard();

    await wrapper.findAll("button")[2].trigger("click");
    await onConfirm?.();

    expect(toast.error).toHaveBeenCalledWith("Host is used by 1 station");
  });
});
