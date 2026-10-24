import { expect, it } from "vitest";
import { heroCatalog, heroClasses } from "./data/catalog";
import { createProfile, deleteProfile, eligibleHeroes, generateForProfile, loadProfiles, migrateProfiles, saveProfile, STORAGE_KEY, type PlayerProfile } from "./profiles";
const owned = (heroId: string) => ({ heroId, stars: null, skillLevels: {}, equipment: [] });
function complete(): PlayerProfile {
  const p = createProfile("one", "One"); p.currentSeason = 2;
  p.ownedHeroes = heroCatalog.slice(0, 9).map(h => owned(h.id));
  p.classOverrides = Object.fromEntries(heroCatalog.slice(0, 9).map((h, i) => [h.id, { value: heroClasses[i % 3], verification: "unverified" as const }]));
  p.seasonOverrides = Object.fromEntries(heroCatalog.slice(0, 9).map(h => [h.id, { from: 1, verification: "unverified" as const }]));
  return p;
}
it("keeps the global catalog separate from ownership", () => {
  const p = createProfile("empty", "Empty");
  expect(p.ownedHeroes).toEqual([]);
  expect(eligibleHeroes(p)).toEqual([]);
  expect(heroCatalog.length).toBeGreaterThan(9);
});
it("filters by ownership and inclusive season boundaries; unknown is explicitly provisional", () => {
  const p = complete();
  p.ownedHeroes.pop();
  expect(eligibleHeroes(p)).toHaveLength(8);
  p.seasonOverrides.Ada = { from: 3, verification: "unverified" };
  expect(eligibleHeroes(p).some(h => h.id === "Ada")).toBe(false);
  p.currentSeason = 3;
  expect(eligibleHeroes(p).some(h => h.id === "Ada")).toBe(true);
  p.seasonOverrides.Ada.through = 3;
  p.currentSeason = 4;
  expect(eligibleHeroes(p).some(h => h.id === "Ada")).toBe(false);
  delete p.seasonOverrides.Ada;
  expect(eligibleHeroes(p).some(h => h.id === "Ada")).toBe(true);
  p.currentSeason = null;
  expect(eligibleHeroes(p)).toHaveLength(8);
});
it("isolates saved profiles and round trips hero progress and robots", () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (k: string) => entries.get(k) ?? null, setItem: (k: string, v: string) => { entries.set(k, v); } };
  const a = complete(); a.serverNumber = 100;
  a.ownedHeroes[0] = { heroId: "Ada", stars: 3, skillLevels: { first: 2 }, equipment: [{ name: "User item", level: 1 }] };
  a.ownedRobots = [{ robotId: "User robot", upgrades: { first: 4 } }];
  saveProfile(storage, a); saveProfile(storage, createProfile("two", "Two"));
  const loaded = loadProfiles(storage);
  expect(loaded.profiles[0]).toEqual(a);
  loaded.profiles[0].ownedHeroes[0].skillLevels.first = 999;
  expect(loadProfiles(storage).profiles[0].ownedHeroes[0].skillLevels.first).toBe(2);
  a.name = "Changed"; saveProfile(storage, a);
  expect(loadProfiles(storage).profiles[1].ownedHeroes).toEqual([]);
  expect(deleteProfile(storage, "one").profiles.map(p => p.id)).toEqual(["two"]);
  expect(entries.has(STORAGE_KEY)).toBe(true);
});
it("migrates version 1 without inventing ownership or progress", () => {
  const migrated = migrateProfiles(JSON.stringify({ version: 1, profiles: [{ id: "old", name: "Old", ownedHeroIds: ["Ada", "Ada"] }] }));
  expect(migrated.version).toBe(2);
  expect(migrated.profiles[0].ownedHeroes).toEqual([owned("Ada")]);
  expect(migrated.profiles[0].seasonOverrides).toEqual({});
  expect(eligibleHeroes(migrated.profiles[0]).map(h => h.id)).toEqual(["Ada"]);
  expect(migrateProfiles(JSON.stringify(migrated))).toEqual(migrated);
  expect(migrateProfiles(null).profiles).toEqual([]);
});
it("refuses corrupt or future saves without overwriting storage", () => {
  const raw = JSON.stringify({ version: 99, profiles: [] });
  let writes = 0;
  const storage = { getItem: () => raw, setItem: () => { writes++; } };
  expect(() => saveProfile(storage, complete())).toThrow(/Unsupported/);
  expect(writes).toBe(0);
  expect(() => migrateProfiles("{broken")).toThrow();
});
it("generates only owned eligible heroes in both ratio modes", () => {
  const p = complete();
  const ratio = { shield: 10, bomber: 20, shooter: 70 };
  for (const input of [{ mode: "Shared" as const, ratio }, { mode: "Independent" as const, ratios: [ratio, ratio, ratio] as [typeof ratio, typeof ratio, typeof ratio] }]) {
    const results = generateForProfile(p, input);
    expect(results).toHaveLength(5);
    expect(results[0].teams.map(t => t.ratio)).toEqual([ratio, ratio, ratio]);
  }
  p.ownedHeroes.pop();
  expect(() => generateForProfile(p, { mode: "Shared", ratio })).toThrow(/found 8/);
});


it("cannot select a high-scoring catalog hero that the player does not own", () => {
  const p = complete();
  const ratio = { shield: 0, bomber: 0, shooter: 100 };
  const results = generateForProfile(p, { mode: "Shared", ratio }, { heroPositionPoints: { Vivian: { Left: 1000000 } } });
  for (const f of results) {
    expect(f.teams.flatMap(t => Object.values(t.heroes).map(h => h.id))).not.toContain("Vivian");
    expect(f.score).toBe(0);
  }
});

