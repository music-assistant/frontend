import CustomizeHost from "@/components/ai-radio/CustomizeHost.vue";
import { useHosts } from "@/composables/ai-radio/useHosts";
import { compileHost, GENERIC_SEGMENT_TEMPLATES } from "@/helpers/ai_radio";
import type { HostDraft } from "@/helpers/ai_radio";
import type { AIRadioHost } from "@/plugins/api/interfaces";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

type SendCommand = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;

const { sendCommand } = vi.hoisted(() => ({
  sendCommand: vi.fn<SendCommand>(async () => []),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    // useHosts derives ai_radio availability from the provider list.
    providers: {},
    sendCommand,
  },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  onBeforeRouteLeave: vi.fn(),
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: vi.fn() },
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/** Mounts the editor in create mode (a new host seeded with one generic example segment per placement). */
async function mountEditor() {
  const wrapper = mount(CustomizeHost);
  await flushPromises();
  return wrapper;
}

function saveButton(wrapper: VueWrapper) {
  return wrapper
    .findAll("button")
    .find((candidate) => /^Save host|Saving/.test(candidate.text()));
}

async function save(wrapper: VueWrapper) {
  await saveButton(wrapper)?.trigger("click");
  await flushPromises();
}

const aiRadioCommands = () =>
  sendCommand.mock.calls
    .map(([command]) => command)
    .filter((command) => command.startsWith("ai_radio/"));

afterEach(() => {
  vi.clearAllMocks();
  sendCommand.mockImplementation(async () => []);
  useHosts().hosts.value = [];
});

describe("CustomizeHost save", () => {
  it("writes every section before the host that references them", async () => {
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    const commands = aiRadioCommands();
    const lastSectionSave = commands.lastIndexOf("ai_radio/sections/save");
    expect(lastSectionSave).toBeGreaterThan(-1);
    expect(commands.indexOf("ai_radio/hosts/save")).toBeGreaterThan(
      lastSectionSave,
    );
  });

  it("writes nothing when the draft fails validation", async () => {
    const { toast } = await import("vue-sonner");
    // The name is empty on a fresh draft, and sections are written before the
    // host, so a save that can't succeed must not reach the server at all.
    const wrapper = await mountEditor();

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/sections/save");
    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith("Host name is required");
  });

  it("refuses to create a host that would overwrite one with the same name", async () => {
    const { toast } = await import("vue-sonner");
    const existing: AIRadioHost = {
      id: "morning_crew",
      name: "Morning Crew",
      instructions: "",
      tts_engine: "",
      language: "",
      options: {},
      section_ids: [],
      section_order: [],
      merge_section_id: "",
    };
    sendCommand.mockImplementation(async (command) =>
      command === "ai_radio/hosts/list" ? [existing] : [],
    );
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith(
      "A host named «Morning Crew» already exists",
    );
  });

  it("refuses to save a new host when the uniqueness check can't be verified", async () => {
    const { toast } = await import("vue-sonner");
    sendCommand.mockImplementation(async (command) => {
      if (command === "ai_radio/hosts/list") {
        throw new Error("network down");
      }
      return [];
    });
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith(
      "Couldn't verify the name is unique. Nothing was saved",
    );
    // The button must recover to a clickable, non-stuck state.
    expect(saveButton(wrapper)?.text()).toBe("Save host");
    expect(saveButton(wrapper)?.attributes("disabled")).toBeUndefined();
  });

  it("still refuses a colliding name once the pre-save refresh reveals it", async () => {
    const { toast } = await import("vue-sonner");
    const existing: AIRadioHost = {
      id: "morning_crew",
      name: "Morning Crew",
      instructions: "",
      tts_engine: "",
      language: "",
      options: {},
      section_ids: [],
      section_order: [],
      merge_section_id: "",
    };
    // Create mode no longer preloads hosts at mount, so this collision can
    // only be caught by the pre-save refresh itself.
    sendCommand.mockImplementation(async (command) =>
      command === "ai_radio/hosts/list" ? [existing] : [],
    );
    const wrapper = await mountEditor();
    await wrapper.find("#customize-host-name").setValue("Morning Crew");

    await save(wrapper);

    expect(aiRadioCommands()).not.toContain("ai_radio/hosts/save");
    expect(toast.error).toHaveBeenCalledWith(
      "A host named «Morning Crew» already exists",
    );
  });

  it("saves an edited host without requiring an extra hosts refresh", async () => {
    const { toast } = await import("vue-sonner");
    const draft: HostDraft = {
      id: "rick",
      name: "Rick",
      instructions: "Persona.",
      ttsEngine: "",
      language: "",
      options: {},
      segments: GENERIC_SEGMENT_TEMPLATES.slice(0, 1).map((s) => ({ ...s })),
    };
    const { host, sections } = compileHost(draft);
    sendCommand.mockImplementation(async (command) => {
      if (command === "ai_radio/hosts/get") return host;
      if (command === "ai_radio/sections/list") return sections;
      return [];
    });
    const wrapper = mount(CustomizeHost, { props: { hostId: host.id } });
    await flushPromises();

    await save(wrapper);

    const commands = aiRadioCommands();
    expect(commands).toContain("ai_radio/hosts/save");
    // Any hosts/list call in edit mode can only be saveHost's post-save
    // refresh, never a pre-save uniqueness check (edit keeps its own id).
    const listIndex = commands.indexOf("ai_radio/hosts/list");
    const saveIndex = commands.indexOf("ai_radio/hosts/save");
    if (listIndex !== -1) {
      expect(listIndex).toBeGreaterThan(saveIndex);
    }
    expect(toast.error).not.toHaveBeenCalled();
  });
});
