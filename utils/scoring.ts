import { EventDefinition, EventType, HouseColor, HouseStats, PointsConfig, ScoringConfig, SystemConfig, WinnerProfile } from '../types';
import { activeHouseIds, eventById, normalizeSystemConfig } from './systemConfig';

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

export const getPositionScore = (
  eventDef: EventDefinition,
  winner: WinnerProfile,
  index: number,
  pointsConfig: PointsConfig,
  systemConfig: SystemConfig
) => {
  if (!shouldScoreEvent(eventDef, systemConfig)) return 0;

  if (isMedalMode(systemConfig)) {
    return index <= 2 ? 1 : 0;
  }

  if (eventDef.type === EventType.KHUSUS && eventDef.id !== 'khas_tariktali') {
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
    const eventId = parts.slice(0, parts.length - 2).join('_');
    const eventDef = eventById(systemConfig, eventId);
    if (!eventDef || !shouldScoreEvent(eventDef, systemConfig) || !Array.isArray(positions)) return;

    positions.forEach((winner, index) => {
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
