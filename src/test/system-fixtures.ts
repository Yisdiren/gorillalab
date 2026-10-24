import { createProfile, type PlayerProfile, type Storage } from "../profiles";
import { classifiedFixture } from "./fixtures";
export function systemProfile(): PlayerProfile {
  const p = createProfile("system-player", "Synthetic system test player"); p.serverNumber = 10004; p.currentSeason = 6;
  p.ownedHeroes = classifiedFixture.map(h => ({ heroId: h.id, stars: 3, skillLevels: {}, equipment: [] }));
  p.seasonOverrides = Object.fromEntries(classifiedFixture.map(h => [h.id, { from: 1, verification: "unverified" as const }]));
  p.classOverrides = Object.fromEntries(classifiedFixture.map(h => [h.id, { value: h.class!.value, verification: "unverified" as const }]));
  return p;
}
export function systemStorage(): Storage {
  const entries = new Map<string, string>(); return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } };
}
