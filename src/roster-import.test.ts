import { suppliedRosterExcerpt } from "./test/roster-excerpt";
import { describe, expect, it } from "vitest";
import { heroCatalog } from "./data/catalog";
import { createProfile, loadProfiles, saveProfile, STORAGE_KEY } from "./profiles";
import { importRoster, matchRosterName, parseRoster, rosterIssues, rosterReport } from "./roster-import";
const options = { mode: "merge" as const, confirmStarChanges: false, confirmRemovals: false };
describe("TXT roster parsing and exact matching", () => {
  it("supports section headings, flexible star formats, CRLF, capitalization and whitespace", () => {
    const rows = parseRoster("\uFEFFShieldbearer:\r\n durga ★5\r\nBomber\r\n ADA   4 stars\r\nShooter\r\nFlameborne - 4★", heroCatalog);
    expect(rows.map(r => [r.heroId, r.stars, r.heroClass])).toEqual([["Durga", 5, "Shieldbearer"], ["Ada", 4, "Bomber"], ["Flameborne", 4, "Shooter"]]);
    expect(parseRoster("Ada | Bomber | ★★★★", heroCatalog)[0].stars).toBe(4);
  });
  it("uses documented aliases without fuzzy guesses", () => {
    expect(matchRosterName(" rYuIcHi ", heroCatalog)).toBe("Ryuichi Ito");
    expect(matchRosterName("Mia   Scarlet Pyros", heroCatalog)).toBe("Mia");
    expect(matchRosterName("Adah", heroCatalog)).toBe("");
    expect(matchRosterName("Ada", [...heroCatalog, { ...heroCatalog[0], id: "ambiguous", name: "ADA" }])).toBe("");
  });
  it("rejects duplicates, invalid stars and unknown heroes", () => {
    const rows = parseRoster("Ada 4 stars\nada ★5\nNo Such Hero 3 stars\nDurga ★6\nMia 2.5 stars", heroCatalog);
    expect(rosterIssues(rows, heroCatalog).join(" ")).toMatch(/Duplicate hero/);
    expect(rosterIssues(rows, heroCatalog).join(" ")).toMatch(/Unknown hero/);
    expect(rosterIssues(rows, heroCatalog).join(" ")).toMatch(/whole number/);
    expect(() => importRoster(createProfile("p", "P"), rows, heroCatalog, options)).toThrow();
  });
  it("rejects empty, binary, oversized and heading-only files", () => {
    for (const text of ["", "\0Ada", "a".repeat(200001), "Bomber\nShooter"]) expect(() => parseRoster(text, heroCatalog)).toThrow();
    expect(rosterIssues(parseRoster("Ada 4 stars 5★", heroCatalog), heroCatalog).join()).toMatch(/Multiple/);
  });
});
describe("roster import safety", () => {
  function fixture() { const p = createProfile("one", "One"); p.ownedHeroes = [{ heroId: "Ada", stars: 3, skillLevels: { war: 2 }, equipment: [{ name: "Kit", level: 4 }], exclusiveEquipment: { name: "EE", level: 1, upgrades: { x: 2 } } }, { heroId: "Mia", stars: 5, skillLevels: {}, equipment: [] }]; p.ownedRobots = [{ robotId: "R", upgrades: { x: 1 }, level: 3 }]; p.teamRobotIds = ["R", null, null]; p.seasonOverrides.Ada = { from: 5, verification: "unverified" }; return p; }
  it("requires explicit star confirmation and preserves progression and all robot/season settings", () => {
    const p = fixture(), before = structuredClone(p), rows = parseRoster("Ada 4 stars\nDurga ★5", heroCatalog);
    expect(() => importRoster(p, rows, heroCatalog, options)).toThrow(/Confirm overwriting/);
    const next = importRoster(p, rows, heroCatalog, { ...options, confirmStarChanges: true });
    expect(next.ownedHeroes).toHaveLength(3);
    expect(next.ownedHeroes[0]).toEqual({ ...p.ownedHeroes[0], stars: 4 });
    expect(next.ownedRobots).toEqual(p.ownedRobots); expect(next.teamRobotIds).toEqual(p.teamRobotIds); expect(next.seasonOverrides).toEqual(p.seasonOverrides); expect(p).toEqual(before);
  });
  it("replace requires removal confirmation; unspecified stars never erase stars", () => {
    const p = fixture(), rows = parseRoster("Ada", heroCatalog);
    expect(() => importRoster(p, rows, heroCatalog, { ...options, mode: "replace" })).toThrow(/Confirm removal/);
    const next = importRoster(p, rows, heroCatalog, { ...options, mode: "replace", confirmRemovals: true });
    expect(next.ownedHeroes).toEqual([p.ownedHeroes[0]]);
  });
  it("saves only the selected profile with existing schema compatibility", () => {
    const values = new Map<string, string>(); const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
    const other = createProfile("two", "Two"); saveProfile(storage, fixture()); saveProfile(storage, other);
    const next = importRoster(fixture(), parseRoster("Durga ★5", heroCatalog), heroCatalog, options); saveProfile(storage, next);
    expect(loadProfiles(storage).profiles).toEqual([next, other]); expect(JSON.parse(values.get(STORAGE_KEY)!).version).toBe(2);
  });
  it("allows explicit corrections/skipping and flags class conflicts", () => {
    const catalog = [{ ...heroCatalog.find(h => h.id === "Ada")!, class: { value: "Bomber" as const, source: "fixture" } }];
    const rows = parseRoster("Shooter\nAda ★4\nAdah ★5", catalog); expect(rosterIssues(rows, catalog).join()).toMatch(/Class conflicts/);
    rows[0].heroClass = null; rows[1].skip = true;
    expect(importRoster(createProfile("p", "P"), rows, catalog, options).ownedHeroes).toHaveLength(1);
  });
});


describe("plural-heading roster regression", () => {
  it.each(["", "\uFEFF"])("parses all 12 supplied entries with optional BOM %j and separates missing catalog data", bom => {
    const rows = parseRoster(bom + suppliedRosterExcerpt.replace(/\n/g, "\r\n"), heroCatalog);
    expect(rows).toHaveLength(12);
    expect(rows.map(r => r.name)).toEqual(["Durga", "Harton", "Gerd", "Iwado", "Pasino", "Gimes", "Lunarl", "Flameborne", "Aiksen", "Flora", "Platos", "Ada"]);
    expect(rows.map(r => r.stars)).toEqual([5, 5, 5, 4, 5, 5, 5, 4, 5, 4, 4, 4]);
    const report = rosterReport(rows, heroCatalog);
    expect(report.sections).toEqual({ Shieldbearer: 4, Bomber: 4, Shooter: 4 });
    expect(report.parsingErrors).toEqual([]); expect(report.matched).toBe(12);
    expect(report.unmatched).toEqual([]);
    expect(rows.find(r => r.name === "Iwado")?.heroId).toBe("Iwado");
  });
  it("handles 45 distinct catalog names in a synthetic 13/17/15 format fixture, preserving multiword names", () => {
    // Structural coverage only: the user's remaining 33 entries have not been supplied.
    const heroes = heroCatalog.slice(0, 45);
    const groups = [heroes.slice(0, 13), heroes.slice(13, 30), heroes.slice(30, 45)];
    const text = groups.map((group, i) => `${["Shieldbearers:", "Bombers:", "Shooters:"][i]}\n${group.map((h, j) => `${h.name} ★${j % 2 ? 4 : 5}`).join("\n")}`).join("\n\n");
    const rows = parseRoster("\uFEFF" + text, heroCatalog), report = rosterReport(rows, heroCatalog);
    expect(rows).toHaveLength(45); expect(rows.map(r => r.heroId)).toEqual(heroes.map(h => h.id));
    expect(rows.map(r => r.name)).toEqual(heroes.map(h => h.name));
    expect(rows.map(r => r.stars)).toEqual(groups.flatMap(g => g.map((_, j) => j % 2 ? 4 : 5)));
    expect(report.parsingErrors).toEqual([]); expect(report.matched).toBe(45);
    expect(report.sections).toEqual({ Shieldbearer: 13, Bomber: 17, Shooter: 15 });
  });
  it("keeps singular headings, handles plural headings case-insensitively, and rejects heading-only input", () => {
    expect(parseRoster("sHiElDbEaReRs:\nRyuichi Ito ★4", heroCatalog)[0]).toMatchObject({ name: "Ryuichi Ito", heroClass: "Shieldbearer", stars: 4 });
    expect(() => parseRoster("Shieldbearers:\nBombers:\nShooters:", heroCatalog)).toThrow(/No hero entries/);
  });
});


it("matches canonical Iwado and verified display name without conflating Iwakado", () => {
  expect(matchRosterName("Iwado", heroCatalog)).toBe("Iwado");
  expect(matchRosterName("  SUMO Tyrant,   Iwado ", heroCatalog)).toBe("Iwado");
  expect(matchRosterName("Iwakado", heroCatalog)).toBe("Iwakado");
  const p = createProfile("iwado-test", "Iwado Test");
  p.ownedHeroes = [{ heroId: "Iwakado", stars: 2, skillLevels: { old: 1 }, equipment: [] }];
  for (const name of ["Iwado", "Sumo Tyrant, Iwado"]) {
    const rows = parseRoster(`Shieldbearers:\n${name} ★4`, heroCatalog);
    expect(rosterIssues(rows, heroCatalog)).toEqual([]);
    const imported = importRoster(p, rows, heroCatalog, options);
    expect(imported.ownedHeroes).toEqual([...p.ownedHeroes, { heroId: "Iwado", stars: 4, skillLevels: {}, equipment: [] }]);
    expect(p.ownedHeroes).toHaveLength(1);
  }
  expect(rosterIssues(parseRoster("Iwado ★4\nSumo Tyrant, Iwado ★4", heroCatalog), heroCatalog).join()).toMatch(/Duplicate hero/);
});
