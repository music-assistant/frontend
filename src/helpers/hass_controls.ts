import type { HassControlKey } from "@/helpers/config_entry_ui";
import { api } from "@/plugins/api";
import type { ProviderInstance } from "@/plugins/api/interfaces";

export const HASS_DOMAIN = "hass";

const SEARCH_CONTROL_ENTITIES_COMMAND = `${HASS_DOMAIN}/search_control_entities`;

export interface HassControlEntity {
  entity_id: string;
  name: string;
  power: boolean;
  volume: boolean;
  mute: boolean;
}

export interface HassControlEntityGroup {
  device_id: string | null;
  // null when the entity has no device, respectively no area
  device_name: string | null;
  area_name: string | null;
  entities: HassControlEntity[];
}

export interface HassControlEntitySearchResult {
  groups: HassControlEntityGroup[];
  // true when matches were left out to honour the requested limit
  truncated: boolean;
}

/**
 * The available Home Assistant provider instance, or undefined when there is none.
 */
export const getHassProviderInstance = (): ProviderInstance | undefined =>
  Object.values(api.providers).find(
    (provider) => provider.domain === HASS_DOMAIN && provider.available,
  );

/**
 * Search the Home Assistant entities that can act as a player control, grouped by the
 * device and area they belong to.
 *
 * Rejects when Home Assistant cannot be searched; the caller reports that itself, so no
 * global error toast is raised.
 *
 * @param controlType Control role the returned entities must be able to serve.
 * @param search Text to match against the entity, device and area names. Every eligible
 *   entity matches when empty.
 * @param limit Maximum number of entities to return; the server decides when omitted.
 */
export const searchHassControlEntities = (
  controlType: HassControlKey,
  search: string,
  limit?: number,
): Promise<HassControlEntitySearchResult> =>
  api.sendCommand<HassControlEntitySearchResult>(
    SEARCH_CONTROL_ENTITIES_COMMAND,
    { control_type: controlType, search, limit },
    { suppressGlobalError: true },
  );

/**
 * Add an entity to one of the Home Assistant provider's player control lists.
 *
 * Only the affected list is written, so a concurrent edit of the rest of the provider
 * config survives. Adding an entity that is already listed does nothing.
 *
 * @param instanceId The Home Assistant provider instance to write to.
 * @param controlKey The control list the entity is added to.
 * @param entityId The Home Assistant entity to register as a control.
 */
export const addHassControlEntity = async (
  instanceId: string,
  controlKey: HassControlKey,
  entityId: string,
): Promise<void> => {
  const config = await api.getProviderConfig(instanceId);
  const current = (config.values[controlKey]?.value ?? []) as string[];
  if (current.includes(entityId)) return;
  await api.saveProviderConfig(
    config.domain,
    { [controlKey]: [...current, entityId] },
    instanceId,
  );
};
