import { expect, it } from "vitest";
import sample from "../public/optional-stiletto260.json";
import { BATTLE_KEY, battlesForServer, compareBattles, emptyBattle, exportBattleCSV, exportBattleJSON, importBattles, loadBattles, parseBattleCSV, parseBattles, saveBattle, validBattle } from "./battles";
import { systemStorage } from "./test/system-fixtures";
function record(id = "first", server = 260) { const b = emptyBattle(id, server, "space"); b.damage = 100; b.attackKind = "individual"; b.attackCount = 1; return b; }
it("saves personal records locally and leaves missing metadata null", () => {
  const storage = systemStorage(), battle = record(); saveBattle(storage, battle);
  const loaded = loadBattles(storage); expect(loaded).toEqual([battle]);
  expect(loaded[0].date).toBeNull(); expect(loaded[0].formation).toBeNull(); expect(loaded[0].robotIds).toBeNull();
  loaded[0].damage = 999; expect(loadBattles(storage)[0].damage).toBe(100);
});
it("round trips JSON and CSV losslessly including quotes, commas, newlines and spreadsheet-like strings", () => {
  const battle = record(); battle.playerName = '=HYPERLINK("fixture")'; battle.notes = 'Quote " here, comma\nand a new line';
  const data = [battle, record("second", 10004)];
  expect(parseBattles(exportBattleJSON(data, 260))).toEqual([battle]);
  const csv = exportBattleCSV(data, 260); expect(parseBattleCSV(csv)).toEqual([battle]);
  expect(csv).toContain('""=HYPERLINK');
  expect(battlesForServer(data, 10004).map(b => b.id)).toEqual(["second"]);
});
it("imports atomically, isolates servers, and rejects conflicting duplicates, corrupt and future data", () => {
  const storage = systemStorage(); const b = record(); saveBattle(storage, b);
  const before = storage.getItem(BATTLE_KEY);
  expect(() => importBattles(storage, exportBattleJSON([record("other", 10004)], 10004), "json", 260)).toThrow(/another server/);
  expect(storage.getItem(BATTLE_KEY)).toBe(before);
  expect(importBattles(storage, exportBattleJSON([b], 260), "json", 260)).toHaveLength(1);
  expect(() => importBattles(storage, exportBattleJSON([{ ...b, damage: 200 }], 260), "json", 260)).toThrow(/Conflicting/);
  expect(() => parseBattles('{"version":99,"records":[]}')).toThrow();
  expect(() => parseBattleCSV('id,damage\n"unterminated')).toThrow();
  const corrupt = { getItem: () => "broken", setItem: () => { throw new Error("must not write"); } };
  expect(() => saveBattle(corrupt, record("new"))).toThrow();
});
it("distinguishes individual attacks, five-attack totals and unknown aggregation", () => {
  const a = record(), b = record("second"); b.damage = 150;
  const compared = compareBattles(a, b);
  expect(compared.damageDifference).toBe(50); expect(compared.controlled).toBe(false);
  expect(compared.differences.some(d => d.includes("missing metadata"))).toBe(true);
  b.attackKind = "five-attack-total"; b.attackCount = 5;
  expect(compareBattles(a, b).damageDifference).toBeNull();
  b.attackKind = "unknown"; b.attackCount = null; expect(compareBattles(a, b).comparable).toBe(false);
  b.attackKind = "individual"; b.attackCount = 1; b.server = 10004; expect(compareBattles(a, b).comparable).toBe(false);
  b.server = 260; b.date = "2026-02-30"; expect(validBattle(b)).toBe(false);
  b.date = null; b.attackCount = 5; expect(validBattle(b)).toBe(false);
});
it("keeps optional Stiletto records opt-in, preserving dates, unknowns, and totals without inventing single hits", () => {
  const storage = systemStorage(); expect(loadBattles(storage)).toEqual([]);
  const records = parseBattles(JSON.stringify(sample)); expect(records).toHaveLength(11);
  expect(records.every(b => b.server === 260 && b.formation === null && b.troopCounts === null && b.robotIds === null && b.progressionSnapshot === null)).toBe(true);
  expect(records.find(b => b.damage === 998882384)).toMatchObject({ eventId: "primal", date: "2026-10-14", attackKind: "five-attack-total", attackCount: 5 });
  expect(records.find(b => b.damage === 470272776)).toMatchObject({ eventId: "treasure", date: "2026-10-16", attackKind: "five-attack-total" });
  expect(records.find(b => b.damage === 559430622)).toMatchObject({ date: null, attackKind: "unknown" });
  expect(storage.getItem(BATTLE_KEY)).toBeNull();
});

it("explains progression changes without claiming their observed damage difference is causal", async () => {
  const { systemProfile } = await import("./test/system-fixtures");
  const p = systemProfile(); p.ownedRobots = [{ robotId: "Fixture robot", level: 1, cores: { module: 1 }, upgrades: {} }];
  const a = record("before", p.serverNumber!); a.profileId = p.id; a.progressionSnapshot = structuredClone(p);
  const b = { ...structuredClone(a), id: "after", damage: 200 };
  b.progressionSnapshot!.ownedHeroes[0].stars = 4;
  b.progressionSnapshot!.ownedRobots[0].level = 2;
  b.progressionSnapshot!.ownedRobots[0].cores!.module = 3;
  const comparison = compareBattles(a, b);
  expect(comparison.differences).toContain("Ada stars: 3 → 4.");
  expect(comparison.differences).toContain("Fixture robot level: 1 → 2.");
  expect(comparison.differences).toContain("Fixture robot: core progression changed.");
  expect(comparison.explanation).toContain("prevent a causal damage claim");
});
