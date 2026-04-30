export enum HouseColor {
  MERAH = 'MERAH',
  BIRU = 'BIRU',
  HIJAU = 'HIJAU',
  KUNING = 'KUNING',
  UNGU = 'UNGU',
  OREN = 'OREN',
}

export enum Gender {
  LELAKI = 'L',
  PEREMPUAN = 'P',
  CAMPURAN = 'C', // Added for Perbarisan/Open events
}

export enum Category {
  TAHAP_1 = 'TAHAP 1',
  TAHAP_2 = 'TAHAP 2',
}

export enum EventType {
  INDIVIDU = 'INDIVIDU',
  RELAY = 'RELAY',
  KHUSUS = 'KHUSUS', // New type: Manual point entry for all houses
}

export interface Participant {
  name: string;
  className: string;
}

export interface WinnerProfile {
  house: HouseColor;
  name: string;
  className: string;
  customScore?: number; // Optional: For manual points (Sukantara etc)
  teamMembers?: Participant[]; // Optional: List of members for relay teams
}

export interface EventDefinition {
  id: string;
  name: string;
  type: EventType;
  maxParticipants: number; // Per house
  years: number[]; // Which years participate (0 for Open)
}

// Data Entry Model
export interface RegistrationEntry {
  house: HouseColor;
  year: number;
  gender: Gender;
  eventId: string;
  participants: Participant[]; // Array of Participant objects
}

// Result Model
export interface RaceResult {
  eventId: string;
  year: number;
  gender: Gender;
  // Ordered array of winners
  positions: WinnerProfile[]; 
}

export interface HouseStats {
  house: HouseColor;
  totalPoints: number;
  gold: number;
  silver: number;
  bronze: number;
  pointsTahap1: number;
  pointsTahap2: number;
}

export interface PointsConfig {
  individu: number[];
  relay: number[];
  tarikTali: number[];
}

export interface EventLimitsConfig {
  maxIndividual: number;
  maxRelay: number;
  eventSlots?: Record<string, number>;
}

export type EventCategory = 'TAHAP_1' | 'TAHAP_2' | 'TERBUKA';

export interface HouseSettings {
  id: HouseColor;
  name: string;
  active: boolean;
}

export interface EventSettings extends EventDefinition {
  active: boolean;
  category: EventCategory;
}

export interface SystemConfig {
  houses: HouseSettings[];
  events: EventSettings[];
}
