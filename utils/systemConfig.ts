import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import { EventDefinition, HouseColor, HouseSettings, SystemConfig } from '../types';

export const normalizeSystemConfig = (config?: Partial<SystemConfig> | null): SystemConfig => {
  const houseOverrides = new Map((config?.houses || []).map(house => [house.id, house]));
  const eventOverrides = new Map((config?.events || []).map(event => [event.id, event]));

  const houses = DEFAULT_SYSTEM_CONFIG.houses.map(defaultHouse => ({
    ...defaultHouse,
    ...houseOverrides.get(defaultHouse.id),
  }));

  const defaultEventIds = new Set(DEFAULT_SYSTEM_CONFIG.events.map(event => event.id));
  const customEvents = (config?.events || []).filter(event => !defaultEventIds.has(event.id));
  const events = [
    ...DEFAULT_SYSTEM_CONFIG.events.map(defaultEvent => ({
      ...defaultEvent,
      ...eventOverrides.get(defaultEvent.id),
    })),
    ...customEvents,
  ];

  return { houses, events };
};

export const activeHouses = (config: SystemConfig): HouseSettings[] =>
  normalizeSystemConfig(config).houses.filter(house => house.active);

export const activeHouseIds = (config: SystemConfig): HouseColor[] =>
  activeHouses(config).map(house => house.id);

export const getHouseName = (config: SystemConfig | undefined, house: HouseColor | string): string => {
  const normalized = normalizeSystemConfig(config);
  return normalized.houses.find(item => item.id === house)?.name || HOUSE_CONFIG[house as HouseColor]?.name || String(house);
};

export const getHouseUi = (config: SystemConfig | undefined, house: HouseColor) => ({
  ...HOUSE_CONFIG[house],
  name: getHouseName(config, house),
});

export const activeEvents = (config: SystemConfig): EventDefinition[] =>
  normalizeSystemConfig(config).events
    .filter(event => event.active)
    .map(({ active, category, ...event }) => event);

export const eventsForYear = (config: SystemConfig, year: number): EventDefinition[] =>
  activeEvents(config).filter(event => event.years.includes(year));

export const eventById = (config: SystemConfig, eventId: string): EventDefinition | undefined =>
  activeEvents(config).find(event => event.id === eventId);
