import { EventDefinition, EventType, Gender, HouseColor, HouseStats, PointsConfig, ScoringConfig, SystemConfig, WinnerProfile } from '../types';
import { activeHouseIds, eventById, getEventCompetitionGroup, getEventGenders, normalizeSystemConfig } from './systemConfig';

export const getScoringConfig = (systemConfig: SystemConfig): Required<ScoringConfig> =>
  normalizeSystemConfig(systemConfig).scoring || { mode: 'POINTS', scope: 'ALL_EVENTS' };

export const isMedalMode = (systemConfig: SystemConfig) => getScoringConfig(systemConfig).mode === 'MEDALS';

export const scoreUnit = (systemConfig: SystemConfig) => (isMedalMode(systemConfig) ? 'pingat' : 'mata');

export const scoreTitle = (systemConfig: SystemConfig) => (isMedalMode(systemConfig) ? 'Kutipan Pingat' : 'Kutipan Mata');

export const shouldScoreEvent = (eventDef: EventDefinition | undefined, systemConfig: SystemConfig) => {
  if (!eventDef) return false;
  const scoring = getScoringConfig(systemConfig);
  if (scoring.scope === 'ALL_EVENTS') return true;
  return eventDef.type === EventType.INDIVIDU || eventDef.type === EventType.RELAY;
};

const isManualScoreEvent = (eventDef: EventDefinition) =>
  eventDef.type === EventType.KHUSUS && eventDef.id !== 'khas_tariktali';

export const normalizeResultPositions = (
  eventDef: EventDefinition | undefined,
  positions: WinnerProfile[] = []
): WinnerProfile[] => {
  if (!eventDef || !Array.isArray(positions)) return [];
  if (!isManualScoreEvent(eventDef)) return positions.filter(Boolean);

  return positions
    .filter((winner) => winner?.house && Number(winner.customScore || 0) > 0)
    .sort((a, b) => Number(b.customScore || 0) - Number(a.customScore || 0));
};

export const isCurrentResultKey = (
  eventDef: EventDefinition | undefined,
  year: number,
  gender: Gender,
): boolean => {
  if (!eventDef || Number.isNaN(year)) return false;
  const group = getEventCompetitionGroup(eventDef);
  return group.key === year && getEventGenders(eventDef).includes(gender);
};

export const getPositionScore = (
  eventDef: EventDefinition,
  winner: WinnerProfile,
  index: number,
  pointsConfig: PointsConfig,
  systemConfig: SystemConfig
) => {
  if (!shouldScoreEvent(eventDef, systemConfig)) return 0;

  if (isMedalMode(systemConfig)) {
    if (isManualScoreEvent(eventDef) && Number(winner.customScore || 0) <= 0) return 0;
    return index <= 2 ? 1 : 0;
  }

  if (isManualScoreEvent(eventDef)) {
    return winner.customScore || 0;
  }

  const pointSet =
    eventDef.id === 'khas_tariktali'
      ? pointsConfig.tarikTali
      : eventDef.type === EventType.RELAY
        ? pointsConfig.relay
        : pointsConfig.individu;

  return pointSet[index] || 0;
};

export const sortHouseStats = (stats: HouseStats[], systemConfig: SystemConfig) => {
  const medalMode = isMedalMode(systemConfig);
  return [...stats].sort((a, b) => {
    if (medalMode) {
      return (
        b.gold - a.gold ||
        b.silver - a.silver ||
        b.bronze - a.bronze ||
        b.totalPoints - a.totalPoints ||
        String(a.house).localeCompare(String(b.house))
      );
    }
    return b.totalPoints - a.totalPoints || b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze;
  });
};

export const calculateHouseStats = (
  results: Record<string, WinnerProfile[]>,
  pointsConfig: PointsConfig,
  systemConfig: SystemConfig
): HouseStats[] => {
  const initialStats: Record<HouseColor, HouseStats> = activeHouseIds(systemConfig).reduce((acc, house) => {
    acc[house] = { house, totalPoints: 0, gold: 0, silver: 0, bronze: 0, pointsTahap1: 0, pointsTahap2: 0, rankingScore: 0 };
    return acc;
  }, {} as Record<HouseColor, HouseStats>);

  (Object.entries(results) as [string, WinnerProfile[]][]).forEach(([key, positions]) => {
    const parts = key.split('_');
    const yearStr = parts[parts.length - 2];
    const year = parseInt(yearStr);
    const gender = parts[parts.length - 1] as Gender;
    const eventId = parts.slice(0, parts.length - 2).join('_');
    const eventDef = eventById(systemConfig, eventId);
    if (!eventDef || !isCurrentResultKey(eventDef, year, gender) || !shouldScoreEvent(eventDef, systemConfig) || !Array.isArray(positions)) return;

    normalizeResultPositions(eventDef, positions).forEach((winner, index) => {
      const house = winner?.house;
      if (!house || !initialStats[house]) return;

      const score = getPositionScore(eventDef, winner, index, pointsConfig, systemConfig);
      initialStats[house].totalPoints += score;
      if (index === 0) initialStats[house].gold += 1;
      if (index === 1) initialStats[house].silver += 1;
      if (index === 2) initialStats[house].bronze += 1;
      if ((year <= 3 && year > 0) || year === 8) initialStats[house].pointsTahap1 += score;
      else if (year > 3) initialStats[house].pointsTahap2 += score;
    });
  });

  return Object.values(initialStats).map((stat) => ({
    ...stat,
    rankingScore: isMedalMode(systemConfig)
      ? stat.gold * 1000000 + stat.silver * 10000 + stat.bronze * 100 + stat.totalPoints
      : stat.totalPoints,
  }));
};
