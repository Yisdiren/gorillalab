import { heroCatalog, heroClasses, type Hero, type HeroClass } from "./data/catalog";
import { generateFormations, type FormationConstraints, type RatioMode, type ScoringRules } from "./engine";

export type OwnedHero = {
  heroId: string;
  stars: number | null;
  skillLevels: Record<string, number>;
  equipment: { name: string; level: number | null }[];
  exclusiveEquipment?: { name: string; level: number | null; upgrades: Record<string, number> };
};
export type OwnedRobot = { robotId: string; upgrades: Record<string, number>; level?: number | null; cores?: Record<string, number | null> };
export type PlayerProfile = {
  id: string;
  name: string;
  serverNumber: number | null;
  currentSeason: number | null;
  ownedHeroes: OwnedHero[];
  ownedRobots: OwnedRobot[];
  // Explicit player configuration, not verified release information.
  seasonOverrides: Record<string, { from: number; through?: number; verification: "unverified" }>;
  classOverrides?: Record<string, { value: HeroClass; verification: "unverified" }>;
  teamRobotIds?: [string | null, string | null, string | null];
};
export const STORAGE_KEY = "gorillalab.profiles";
export type ProfileData = { version: 2; profiles: PlayerProfile[] };
export type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export function createProfile(id: string, name: string): PlayerProfile {
  return { id, name, serverNumber: null, currentSeason: null, ownedHeroes: [], ownedRobots: [], seasonOverrides: {}, classOverrides: {} };
}
const integer = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const nullableInteger = (v: unknown) => v === null || integer(v);
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const levels = (v: unknown) => record(v) && Object.values(v).every(integer);
export function validateProfile(p: unknown): p is PlayerProfile {
  if (!record(p)) return false;
  return typeof p.id === "string" && !!p.id && typeof p.name === "string" && !!p.name.trim() &&
    nullableInteger(p.serverNumber) && nullableInteger(p.currentSeason) &&
    Array.isArray(p.ownedHeroes) && p.ownedHeroes.every(h => record(h) && typeof h.heroId === "string" && !!h.heroId && nullableInteger(h.stars) && levels(h.skillLevels) && Array.isArray(h.equipment) && h.equipment.every((e: unknown) => record(e) && typeof e.name === "string" && nullableInteger(e.level)) &&
      (h.exclusiveEquipment === undefined || record(h.exclusiveEquipment) && typeof h.exclusiveEquipment.name === "string" && nullableInteger(h.exclusiveEquipment.level) && levels(h.exclusiveEquipment.upgrades))) &&
    new Set(p.ownedHeroes.map(h => h.heroId)).size === p.ownedHeroes.length &&
    Array.isArray(p.ownedRobots) && p.ownedRobots.every(r => record(r) && typeof r.robotId === "string" && !!r.robotId && levels(r.upgrades) && (r.level === undefined || nullableInteger(r.level)) && (r.cores === undefined || record(r.cores) && Object.values(r.cores).every(nullableInteger))) &&
    new Set(p.ownedRobots.map(r => r.robotId)).size === p.ownedRobots.length &&
    record(p.seasonOverrides) && Object.values(p.seasonOverrides).every(s => record(s) && s.verification === "unverified" && integer(s.from) && (s.through === undefined || integer(s.through) && s.through >= s.from)) &&
    (p.classOverrides === undefined || record(p.classOverrides) && Object.values(p.classOverrides).every(c => record(c) && heroClasses.includes(c.value) && c.verification === "unverified")) &&
    (p.teamRobotIds === undefined || Array.isArray(p.teamRobotIds) && p.teamRobotIds.length === 3 && p.teamRobotIds.every(id => id === null || typeof id === "string" && p.ownedRobots.some((robot: { robotId: string }) => robot.robotId === id)));
}
/** v1: profiles with ownedHeroIds; absent progress and availability remain unknown. */
export function migrateProfiles(raw: string | null): ProfileData {
  if (raw === null) return { version: 2, profiles: [] };
  const data = JSON.parse(raw);
  if (!record(data) || ![1, 2].includes(data.version) || !Array.isArray(data.profiles)) throw new Error("Unsupported saved profile format; saved data has not been changed.");
  const profiles = data.version === 1 ? data.profiles.map((p: any) => {
    if (!record(p) || !Array.isArray(p.ownedHeroIds) || !p.ownedHeroIds.every((id: unknown) => typeof id === "string")) throw new Error("Invalid legacy profile.");
    return { ...createProfile(p.id, p.name), serverNumber: p.serverNumber ?? null, currentSeason: p.currentSeason ?? null,
      ownedRobots: p.ownedRobots === undefined ? [] : p.ownedRobots, ...(p.teamRobotIds === undefined ? {} : { teamRobotIds: p.teamRobotIds }),
      ownedHeroes: [...new Set<string>(p.ownedHeroIds)].map(heroId => ({ heroId, stars: null, skillLevels: {}, equipment: [] })) };
  }) : data.profiles;
  if (!profiles.every(validateProfile) || new Set(profiles.map((p: PlayerProfile) => p.id)).size !== profiles.length) throw new Error("Invalid saved profile data; saved data has not been changed.");
  return structuredClone({ version: 2, profiles });
}
export function loadProfiles(storage: Storage): ProfileData { return migrateProfiles(storage.getItem(STORAGE_KEY)); }
export function saveProfile(storage: Storage, profile: PlayerProfile): ProfileData {
  if (!validateProfile(profile)) throw new Error("Invalid profile fields.");
  const data = loadProfiles(storage);
  const index = data.profiles.findIndex(p => p.id === profile.id);
  if (index < 0) data.profiles.push(structuredClone(profile));
  else data.profiles[index] = structuredClone(profile);
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}
export function deleteProfile(storage: Storage, id: string): ProfileData {
  const data = loadProfiles(storage);
  data.profiles = data.profiles.filter(p => p.id !== id);
  storage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
}
export function eligibilityReport(profile: PlayerProfile, catalog: readonly Hero[] = heroCatalog) {
  if (!validateProfile(profile)) throw new Error("Invalid profile fields.");
  return profile.ownedHeroes.map(owned => {
    const record = catalog.find(h => h.id === owned.heroId);
    if (!record) return { heroId: owned.heroId, hero: null, status: "missing" as const, reason: "Owned ID is missing from the catalog; no identity guessed." };
    const hero = profile.classOverrides?.[record.id] ? { ...record, class: { value: profile.classOverrides[record.id].value, source: "player-profile-unverified" } } : record;
    const season = profile.seasonOverrides[hero.id] ?? hero.seasonAvailability;
    if (!season || profile.currentSeason === null) return { heroId: hero.id, hero, status: "unknown" as const, reason: "Included provisionally: season eligibility is unknown, not confirmed ineligible." };
    const allowed = profile.currentSeason >= season.from && (season.through === undefined || profile.currentSeason <= season.through);
    return { heroId: hero.id, hero, status: allowed ? "eligible" as const : "ineligible" as const, reason: allowed ? "Within the configured season range." : "Excluded: season " + profile.currentSeason + " is outside configured " + season.from + "–" + (season.through ?? "onward") + "." };
  });
}
export function eligibleHeroes(profile: PlayerProfile, catalog: readonly Hero[] = heroCatalog): Hero[] {
  return eligibilityReport(profile, catalog).filter(row => row.status === "eligible" || row.status === "unknown").map(row => row.hero!);
}
export function generateForProfile(profile: PlayerProfile, ratios: RatioMode, rules: ScoringRules = {}, catalog: readonly Hero[] = heroCatalog, constraints: FormationConstraints = {}) {
  const candidates = eligibleHeroes(profile, catalog);
  if (candidates.length < 9) throw new Error(`Nine owned candidate heroes are required; found ${candidates.length}. Known season restrictions are enforced; unknown eligibility is included with a warning.`);
  return generateFormations(ratios, rules, candidates, constraints);
}

