import { expect, it } from "vitest";
import { heroCatalog, heroClasses } from "./data/catalog";
import { generateFormations, positions, SEARCH_LIMITS, validFormation } from "./engine";
const input = { mode: "Shared" as const, ratio: { shield: 0, bomber: 0, shooter: 100 } };
it("bounds expansion work for thousands of heroes and produces deterministic unique valid results", () => {
  const roster = Array.from({ length: 3000 }, (_, i) => ({ ...heroCatalog[0], id: `test-${i}`, name: `Synthetic test fixture ${i}`, class: { value: heroClasses[i % 3], source: "https://example.invalid/synthetic" } }));
  const start = performance.now();
  const first = generateFormations(input, {}, roster);
  const duration = performance.now() - start;
  const second = generateFormations(input, {}, roster);
  expect(first).toEqual(second);
  expect(first).toHaveLength(5);
  expect(new Set(first.map(f => f.id)).size).toBe(5);
  for (const f of first) {
    expect(validFormation(f)).toBe(true);
    expect(f.search.eligibleCount).toBe(3000);
    expect(f.search.consideredCount).toBeLessThanOrEqual(SEARCH_LIMITS.candidateLimit);
    expect(f.search.expandedStates).toBeLessThanOrEqual(3 * 27 * 7 ** 3);
    expect(f.search.optimalityGuaranteed).toBe(true);
  }
  console.info(`Exact additive search: 3000 eligible heroes, ${first[0].search.consideredCount} candidates, ${first[0].search.expandedStates} expansions, ${duration.toFixed(1)}ms (informational, no timing assertion).`);
});
it("considers highly ranked late catalog entries and sorts result scores", () => {
  const roster = Array.from({ length: 100 }, (_, i) => ({ ...heroCatalog[0], id: `fixture-${i}`, name: `Fixture ${i}`, class: { value: heroClasses[i % 3], source: "https://example.invalid/synthetic" } }));
  const results = generateFormations(input, { heroPositionPoints: { "fixture-99": { Left: 100 }, "fixture-98": { Middle: 90 }, "fixture-97": { Right: 80 } } }, roster);
  for (const f of results) {
    const ids = f.teams.flatMap(t => positions.map(p => t.heroes[p].id));
    expect(ids).toContain("fixture-99"); expect(ids).toContain("fixture-98"); expect(ids).toContain("fixture-97");
    expect(f.score).toBe(270);
    expect(f.breakdown.total).toBe(f.score);
  }
  expect(results.map(f => f.score)).toEqual(results.map(f => f.score).sort((a, b) => b - a));
});
it("never treats the catalog as owned when no roster is supplied", () => {
  expect(() => generateFormations(input)).toThrow(/nine/);
});


it("matches an independent exhaustive oracle for position-specific weights without beam ordering bias", () => {
  const roster = Array.from({ length: 10 }, (_, i) => ({ ...heroCatalog[0], id: "oracle-" + i, name: "Oracle " + i, class: { value: heroClasses[i % 3], source: "https://example.invalid/oracle" } }));
  const rules = { heroPositionPoints: Object.fromEntries(roster.map((h, i) => [h.id, { Left: (i * 7) % 17 - 9, Middle: (i * 11) % 23 - 4, Right: (i * 13) % 29 - 2 }])) };
  const ordered = [...roster].sort((a, b) => a.id < b.id ? -1 : 1);
  type Choice = { order: number[]; score: number };
  const compare = (a: Choice, b: Choice) => b.score - a.score || a.order.reduce((d, n, i) => d || n - b.order[i], 0);
  let oracle: Choice[] = [];
  // No score pruning or candidate truncation: enumerate every valid assignment.
  function enumerate(order: number[], score: number) {
    if (order.length === 9) { oracle.push({ order: [...order], score }); oracle.sort(compare); oracle = oracle.slice(0, 5); return; }
    const start = Math.floor(order.length / 3) * 3;
    for (let i = 0; i < ordered.length; i++) {
      if (order.includes(i) || order.slice(start).some(j => ordered[j].class.value === ordered[i].class.value)) continue;
      enumerate([...order, i], score + rules.heroPositionPoints[ordered[i].id][positions[order.length % 3]]);
    }
  }
  enumerate([], 0);
  const result = generateFormations(input, rules, roster);
  expect(result.map(f => [f.id, f.score])).toEqual(oracle.map(c => [JSON.stringify(c.order.map(i => ordered[i].id)), c.score]));
  expect(generateFormations(input, rules, [...roster].reverse())).toEqual(result);
});
it("safely prunes only dominated slot choices and breaks all-score ties by canonical ID", () => {
  const roster = Array.from({ length: 90 }, (_, i) => ({ ...heroCatalog[0], id: "late-" + String(i).padStart(3, "0"), name: "Fixture " + i, class: { value: heroClasses[i % 3], source: "https://example.invalid/test" } }));
  const rules = { heroPositionPoints: Object.fromEntries(roster.map((h, i) => [h.id, { Left: i, Middle: i, Right: i }])) };
  const result = generateFormations(input, rules, roster);
  const expected = heroClasses.flatMap(c => roster.filter(h => h.class.value === c).slice(-3).map(h => h.id));
  for (const f of result) expect(f.teams.flatMap(t => positions.map(p => t.heroes[p].id)).sort()).toEqual(expected.sort());
  const tied = generateFormations(input, {}, roster);
  expect(generateFormations(input, {}, [...roster].reverse())).toEqual(tied);
});
