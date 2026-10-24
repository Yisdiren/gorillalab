import { heroClasses, type Hero } from "./data/catalog";
/** Exact additive top five. The top 7 per slot suffice: at most two higher
 * choices are occupied, leaving five better replacements for any omitted one.
 * Scores tie by canonical ID. Ratios are fixed, not damage-optimized. */
export function exactClassSearch(roster: readonly Hero[], contributions: number[][], allowed: (index: number, slot: number) => boolean) {
  type Assignment = { order: number[]; score: number };
  const compare = (a: Assignment, b: Assignment) => b.score - a.score || a.order.reduce((difference, id, i) => difference || id - b.order[i], 0);
  const permutations = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  const cache = new Map<string, Assignment[]>();
  const considered = new Set<number>();
  let expandedStates = 0;
  function classAssignments(kind: number, slots: number[]): Assignment[] {
    const key = kind + ":" + slots.join(",");
    const cached = cache.get(key); if (cached) return cached;
    const choices = slots.map(slot => roster.map((_, index) => index).filter(index => roster[index].class?.value === heroClasses[kind] && allowed(index, slot))
      .sort((a, b) => contributions[slot][b] - contributions[slot][a] || a - b).slice(0, 7));
    choices.flat().forEach(i => considered.add(i));
    const assignments: Assignment[] = [];
    for (const a of choices[0]) for (const b of choices[1]) for (const c of choices[2]) {
      expandedStates++;
      if (a === b || a === c || b === c) continue;
      const score = contributions[slots[0]][a] + contributions[slots[1]][b] + contributions[slots[2]][c];
      if (!Number.isFinite(score)) throw new Error("Scoring overflow: reduce configured weights.");
      assignments.push({ order: [a,b,c], score });
    }
    assignments.sort(compare);
    const best = assignments.slice(0, 5); cache.set(key, best); return best;
  }
  let best: Assignment[] = [];
  // Only 6^3 class-position patterns, not factorial permutations of the catalog.
  for (const p0 of permutations) for (const p1 of permutations) for (const p2 of permutations) {
    const pattern = [p0,p1,p2];
    const slots = heroClasses.map((_, kind) => pattern.map((p, team) => team * 3 + p.indexOf(kind)));
    const sets = slots.map((s, kind) => classAssignments(kind, s));
    for (const a of sets[0]) for (const b of sets[1]) for (const c of sets[2]) {
      const order = Array<number>(9);
      [a,b,c].forEach((assignment, kind) => assignment.order.forEach((index, team) => { order[slots[kind][team]] = index; }));
      best.push({ order, score: a.score + b.score + c.score });
    }
    best.sort(compare); best = best.slice(0, 5);
  }
  return { best, expandedStates, consideredCount: considered.size };
}
