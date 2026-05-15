import { AccessConfig, EventCategory, EventDefinition, EventSettings, EventType, HouseColor, HouseSettings, SystemConfig } from './types';

export const HOUSE_CONFIG = {
  [HouseColor.MERAH]: { color: 'bg-red-600', text: 'text-white', border: 'border-red-600', name: 'Merah' },
  [HouseColor.BIRU]: { color: 'bg-blue-600', text: 'text-white', border: 'border-blue-600', name: 'Biru' },
  [HouseColor.HIJAU]: { color: 'bg-green-600', text: 'text-white', border: 'border-green-600', name: 'Hijau' },
  [HouseColor.KUNING]: { color: 'bg-yellow-400', text: 'text-black', border: 'border-yellow-400', name: 'Kuning' },
  [HouseColor.UNGU]: { color: 'bg-purple-600', text: 'text-white', border: 'border-purple-600', name: 'Ungu' },
  [HouseColor.OREN]: { color: 'bg-orange-500', text: 'text-white', border: 'border-orange-500', name: 'Oren' },
};

export const EVENTS_TAHAP_1: EventDefinition[] = [
  { id: 't1_80m', name: '80m', type: EventType.INDIVIDU, maxParticipants: 3, years: [1, 2, 3] },
  { id: 't1_lj', name: 'Lompat Jauh', type: EventType.INDIVIDU, maxParticipants: 3, years: [1, 2, 3] },
  { id: 't1_sp', name: 'Lontar Peluru', type: EventType.INDIVIDU, maxParticipants: 3, years: [1, 2, 3] },
  { id: 't1_4x80', name: '4x80m', type: EventType.RELAY, maxParticipants: 4, years: [1, 2, 3] },
  { id: 'sk_t1_80m', name: 'Sukantara 80m', type: EventType.KHUSUS, maxParticipants: 0, years: [1, 2, 3] },
  { id: 'sk_t1_lj', name: 'Sukantara Lompat Jauh', type: EventType.KHUSUS, maxParticipants: 0, years: [1, 2, 3] },
  { id: 'sk_t1_sp', name: 'Sukantara Lontar Peluru', type: EventType.KHUSUS, maxParticipants: 0, years: [1, 2, 3] },
];

export const EVENTS_TAHAP_2: EventDefinition[] = [
  { id: 't2_100m', name: '100m', type: EventType.INDIVIDU, maxParticipants: 3, years: [4, 5, 6] },
  { id: 't2_200m', name: '200m', type: EventType.INDIVIDU, maxParticipants: 3, years: [4, 5, 6] },
  { id: 't2_lj', name: 'Lompat Jauh', type: EventType.INDIVIDU, maxParticipants: 3, years: [4, 5, 6] },
  { id: 't2_sp', name: 'Lontar Peluru', type: EventType.INDIVIDU, maxParticipants: 3, years: [4, 5, 6] },
  { id: 't2_hj', name: 'Lompat Tinggi', type: EventType.INDIVIDU, maxParticipants: 3, years: [4, 5, 6] },
  { id: 't2_hurdle', name: '80m Lari Berpagar', type: EventType.INDIVIDU, maxParticipants: 3, years: [4, 5, 6] },
  { id: 't2_jt', name: 'Merejam Lembing', type: EventType.INDIVIDU, maxParticipants: 3, years: [4, 5, 6] },
  { id: 't2_4x100', name: '4x100m', type: EventType.RELAY, maxParticipants: 4, years: [4, 5, 6] },
  { id: 't2_4x200', name: '4x200m', type: EventType.RELAY, maxParticipants: 4, years: [4, 5, 6] },
  { id: 'sk_t2_100m', name: 'Sukantara 100m', type: EventType.KHUSUS, maxParticipants: 0, years: [4, 5, 6] },
  { id: 'sk_t2_lj', name: 'Sukantara Lompat Jauh', type: EventType.KHUSUS, maxParticipants: 0, years: [4, 5, 6] },
  { id: 'sk_t2_sp', name: 'Sukantara Lontar Peluru', type: EventType.KHUSUS, maxParticipants: 0, years: [4, 5, 6] },
];

// Events that don't fit specific years (Open Category - Single Category)
// EventType.KHUSUS allows manual point entry
export const EVENTS_TERBUKA: EventDefinition[] = [
  { id: 'khas_merentas', name: 'Merentas Desa', type: EventType.KHUSUS, maxParticipants: 0, years: [0] },
  { id: 'khas_tariktali', name: 'Tarik Tali', type: EventType.KHUSUS, maxParticipants: 0, years: [0] },
  { id: 'khas_perbarisan', name: 'Perbarisan Lintas Hormat', type: EventType.KHUSUS, maxParticipants: 0, years: [0] },
];

export const POINTS_INDIVIDUAL = [10, 8, 6, 4, 2, 1]; // Position 1 to 6
export const POINTS_RELAY = [20, 16, 12, 8, 4, 2]; // Double points
export const POINTS_TARIK_TALI = [50, 40, 30, 20, 10, 5]; // High points for major event

const withCategory = (events: EventDefinition[], category: EventCategory): EventSettings[] =>
  events.map(event => ({ ...event, active: true, category }));

export const DEFAULT_HOUSES: HouseSettings[] = Object.values(HouseColor).map(house => ({
  id: house,
  name: HOUSE_CONFIG[house].name,
  active: true,
}));

export const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  houses: DEFAULT_HOUSES,
  events: [
    ...withCategory(EVENTS_TAHAP_1, 'TAHAP_1'),
    ...withCategory(EVENTS_TAHAP_2, 'TAHAP_2'),
    ...withCategory(EVENTS_TERBUKA, 'TERBUKA'),
  ],
  scoring: {
    mode: 'POINTS',
    scope: 'ALL_EVENTS',
  },
  competitionDateTime: '2026-05-09T07:00',
};

export const DEFAULT_ACCESS_CONFIG: AccessConfig = {
  adminPassword: 'SKORANADMIN206',
  housePasswords: {
    [HouseColor.MERAH]: '',
    [HouseColor.BIRU]: '',
    [HouseColor.HIJAU]: '',
    [HouseColor.KUNING]: '',
    [HouseColor.UNGU]: '',
    [HouseColor.OREN]: '',
  },
};
