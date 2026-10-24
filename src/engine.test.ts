import { describe, expect, it } from "vitest";
import { generateFormations, positions, validFormation, validRatio, type RatioMode } from "./engine";
import { classifiedFixture as heroDatabase } from "./test/fixtures";

const shared: RatioMode = { mode: "Shared", ratio: { shield: 0, bomber: 9, shooter: 91 } };
const formations = generateFormations(shared, {}, heroDatabase);

describe("formation validity", () => {
  it("returns five distinct, deterministic formations with nine unique heroes", () => {
    expect(formations).toHaveLength(5);
    expect(new Set(formations.map(f => f.id)).size).toBe(5);
    for (const formation of formations) {
      expect(validFormation(formation)).toBe(true);
      expect(formation.teams).toHaveLength(3);
      expect(formation.teams.flatMap(t => positions.map(p => t.heroes[p].id)).sort()).toEqual(heroDatabase.map(h => h.id).sort());
      expect(formation.teams.every(t => positions.every(p => t.heroes[p].verification === "unverified"))).toBe(true);
      expect(formation.score).toBe(0);
      expect(formation.scoreKind).toBe("heuristic-not-damage");
      expect(formation.warnings).toHaveLength(10);
    }
    expect(formations[0].teams[0].heroes.Left.id).toBe(heroDatabase[0].id);
  });
  it("rejects duplicate heroes in the roster and in a formation", () => {
    expect(() => generateFormations(shared, {}, [...heroDatabase.slice(0, 8), heroDatabase[0]])).toThrow(/unique/);
    expect(() => generateFormations(shared, {}, heroDatabase.slice(0, 8))).toThrow(/nine/);
    const duplicate = structuredClone(formations[0]);
    duplicate.teams[1].heroes.Left = duplicate.teams[0].heroes.Left;
    expect(validFormation(duplicate)).toBe(false);
  });
});

describe("ratios", () => {
  it("requires finite nonnegative percentages totaling exactly 100", () => {
    expect(validRatio({ shield: 0, bomber: 9, shooter: 91 })).toBe(true);
    expect(validRatio({ shield: 100, bomber: 0, shooter: 0 })).toBe(true);
    for (const ratio of [
      { shield: -1, bomber: 10, shooter: 91 },
      { shield: 0, bomber: 9, shooter: 90 },
      { shield: NaN, bomber: 9, shooter: 91 },
      { shield: Infinity, bomber: 0, shooter: 0 },
      { shield: 101, bomber: 0, shooter: -1 },
    ]) {
      expect(validRatio(ratio)).toBe(false);
      expect(() => generateFormations({ mode: "Shared", ratio })).toThrow(/100/);
    }
  });
  it("applies shared ratios to every team with separate output objects", () => {
    expect(formations[0].teams.map(t => t.ratio)).toEqual([shared.ratio, shared.ratio, shared.ratio]);
    expect(formations[0].teams[0].ratio).not.toBe(formations[0].teams[1].ratio);
  });
  it("preserves independent ratios and ranks using configurable points", () => {
    const ratios = [{ shield: 100, bomber: 0, shooter: 0 }, { shield: 0, bomber: 100, shooter: 0 }, { shield: 0, bomber: 0, shooter: 100 }] as const;
    const results = generateFormations({ mode: "Independent", ratios: ratios.map(r => ({ ...r })) as [typeof ratios[number], typeof ratios[number], typeof ratios[number]] }, {
      heroPositionPoints: { Ada: { Left: 10, Middle: -10, Right: -20 } },
      teamTroopWeights: [{ shield: 1 }, { bomber: 2 }, { shooter: 3 }],
    }, heroDatabase);
    expect(results).toHaveLength(5);
    for (const f of results) {
      expect(validFormation(f)).toBe(true);
      expect(f.teams.map(t => t.ratio)).toEqual(ratios);
      expect(f.teams.some(t => t.heroes.Left.name === "Ada")).toBe(true);
      expect(f.score).toBe(610);
      expect(f.breakdown.teams.reduce((sum, t) => sum + t.total, 0)).toBe(f.score);
      expect(f.breakdown.total).toBe(f.score);
    }
    expect(() => generateFormations({ mode: "Independent", ratios: [{ ...ratios[0] }, { ...ratios[1] }, { shield: 0, bomber: 0, shooter: 99 }] })).toThrow(/100/);
  });
  it("rejects nonfinite scoring configuration", () => {
    expect(() => generateFormations(shared, { heroPositionPoints: { Ada: { Left: NaN } } }, heroDatabase)).toThrow(/finite/);
  });
});


