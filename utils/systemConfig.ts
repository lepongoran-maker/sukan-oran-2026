import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import { EventDefinition, Gender, HouseColor, HouseSettings, SystemConfig } from '../types';

export interface CompetitionGroup {
  key: number;
  label: string;
  years: number[];
}

export const normalizeSystemConfig = (config?: Partial<SystemConfig> | null): SystemConfig => {
  const houseOverrides = new Map((config?.houses || []).map(house => [house.id, house]));
  const eventOverrides = new Map((config?.events || []).map(event => [event.id, event]));
  const scoring = {
    ...DEFAULT_SYSTEM_CONFIG.scoring,
    ...(config?.scoring || {}),
  };

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

  return {
    houses,
    events,
    scoring,
    competitionDateTime: config?.competitionDateTime || DEFAULT_SYSTEM_CONFIG.competitionDateTime,
  };
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

export const getCompetitionGroupForYears = (years: number[] = []): CompetitionGroup => {
  const normalizedYears = Array.from(new Set(years)).sort((a, b) => a - b);
  const positiveYears = normalizedYears.filter(year => year > 0);

  if (normalizedYears.includes(0) || normalizedYears.length === 0) {
    return { key: 0, label: 'Terbuka', years: [0] };
  }

  const isSameYears = (expected: number[]) =>
    positiveYears.length === expected.length && expected.every(year => positiveYears.includes(year));

  if (isSameYears([1, 2])) return { key: 8, label: 'Bawah 8', years: [1, 2] };
  if (isSameYears([3, 4])) return { key: 10, label: 'Bawah 10', years: [3, 4] };
  if (isSameYears([5, 6])) return { key: 12, label: 'Bawah 12', years: [5, 6] };

  if (positiveYears.length === 1) {
    const year = positiveYears[0];
    return { key: year, label: `Tahun ${year}`, years: [year] };
  }

  const key = Number(positiveYears.join(''));
  return {
    key: Number.isNaN(key) ? positiveYears[0] : key,
    label: `Tahun ${positiveYears.join(' + ')}`,
    years: positiveYears,
  };
};

export const getEventCompetitionGroup = (event: Pick<EventDefinition, 'years'>): CompetitionGroup =>
  getCompetitionGroupForYears(event.years);

export const formatCompetitionGroupLabel = (groupOrYear: number | CompetitionGroup): string => {
  if (typeof groupOrYear !== 'number') return groupOrYear.label;
  if (groupOrYear === 0) return 'Terbuka';
  if (groupOrYear === 8) return 'Bawah 8';
  if (groupOrYear === 10) return 'Bawah 10';
  if (groupOrYear === 12) return 'Bawah 12';
  return `Tahun ${groupOrYear}`;
};

export const getEventGenders = (event: Pick<EventDefinition, 'name' | 'years'>): Gender[] => {
  const eventName = event.name.toLowerCase();
  if (eventName.includes('lelaki')) return [Gender.LELAKI];
  if (eventName.includes('perempuan')) return [Gender.PEREMPUAN];

  const group = getEventCompetitionGroup(event);
  return group.key === 0 ? [Gender.CAMPURAN] : [Gender.LELAKI, Gender.PEREMPUAN];
};

export const eventMatchesGender = (event: Pick<EventDefinition, 'name' | 'years'>, gender: Gender): boolean =>
  getEventGenders(event).includes(gender);
