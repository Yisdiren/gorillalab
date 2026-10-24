import { exactClassSearch } from "./exact-search";
import { type Hero } from "./data/roster";
import { heroClasses } from "./data/catalog";

export type TroopRatio = { shield: number; bomber: number; shooter: number };
export const positions = ["Left", "Middle", "Right"] as const;
export type Position = typeof positions[number];
export type Triple<T> = [T, T, T];
export type RatioMode =
  | { mode: "Shared"; ratio: TroopRatio }
  | { mode: "Independent"; ratios: Triple<TroopRatio> };
export type ScoringRules = {
  /** User-supplied heuristic points; never verified damage or mechanics. */
  heroPositionPoints?: Record<string, Partial<Record<Position, number>>>;
  /** User-supplied points per percentage point for each team. */
  teamTroopWeights?: Triple<Partial<TroopRatio>>;
};
export type TroopCounts = { shield: number; bomber: number; shooter: number };
export type FormationConstraints = { troopCounts?: Triple<TroopCounts>; adaShieldMinimum?: number };
export type Team = { heroes: Record<Position, Hero>; ratio: TroopRatio; troopCounts?: TroopCounts };
export type TeamBreakdown = {
  positionPoints: Record<Position, number>;
  troopPoints: TroopRatio;
  total: number;
};
export type Formation = {
  id: string;
  teams: Triple<Team>;
  score: number;
  scoreKind: "heuristic-not-damage";
  breakdown: { teams: Triple<TeamBreakdown>; total: number };
  warnings: string[];
  constraints: { adaShieldMinimum: number | null; verification: "pending"; troopCountSource: "player-entered" | "not-provided" | "planned-from-total" };
  search: { strategy: "exact-additive-class-assignment"; beamWidth: number; candidateLimit: number; eligibleCount: number; consideredCount: number; expandedStates: number; optimalityGuaranteed: true };
};
export const validRatio = (r: TroopRatio): boolean =>
  !!r && [r.shield, r.bomber, r.shooter].every(n => Number.isFinite(n) && n >= 0 && n <= 100) &&
  r.shield + r.bomber + r.shooter === 100;

export function validTroopCounts(counts: TroopCounts, ratio: TroopRatio): boolean {
  if (!counts || !validRatio(ratio)) return false;
  const values = [counts.shield, counts.bomber, counts.shooter];
  const total = values.reduce((a, b) => a + b, 0);
  return values.every(n => Number.isSafeInteger(n) && n >= 0) && Number.isSafeInteger(total) && total > 0 &&
    (Object.keys(ratio) as (keyof TroopRatio)[]).every(key => Math.abs(counts[key] - total * ratio[key] / 100) <= 1 + 1e-9);
}

export function validFormation(formation: Formation): boolean {
  const ids = formation.teams.flatMap(team => positions.map(p => team.heroes[p]?.id));
  return formation.teams.length === 3 && ids.every(Boolean) && new Set(ids).size === 9 &&
    formation.teams.every(team => validRatio(team.ratio) && new Set(positions.map(p => team.heroes[p]?.class?.value)).size === 3 &&
      positions.every(p => heroClasses.includes(team.heroes[p]?.class?.value!)) &&
      (!team.troopCounts || validTroopCounts(team.troopCounts, team.ratio)) &&
      (formation.constraints.adaShieldMinimum === null || !positions.some(p => team.heroes[p].id === "Ada") ||
        !!team.troopCounts && team.troopCounts.shield >= formation.constraints.adaShieldMinimum));
}

export const SEARCH_LIMITS = { beamWidth: 0, candidateLimit: 189 } as const;
/** Exact top-five additive assignment search. Returns the exact best five under this additive model, not a
 * damage optimum. Ties use canonical IDs, never stars or catalog order. Ratios are supplied.
 */
export function generateFormations(
  input: RatioMode,
  rules: ScoringRules = {},
  roster: readonly Hero[] = [],
  constraints: FormationConstraints = {},
): Formation[] {
  const ratios = input.mode === "Shared" ? [input.ratio, input.ratio, input.ratio] : input.ratios;
  if (ratios.length !== 3 || !ratios.every(validRatio)) {
    throw new Error("Each team ratio must total exactly 100 with finite nonnegative percentages.");
  }
  if (roster.length < 9 || roster.some(h => !h.id) || new Set(roster.map(h => h.id)).size !== roster.length) {
    throw new Error("At least nine uniquely identified heroes are required.");
  }
  const configured = [
    ...Object.values(rules.heroPositionPoints ?? {}).flatMap(p => Object.values(p)),
    ...(rules.teamTroopWeights ?? []).flatMap(w => Object.values(w)),
  ];
  if (!configured.every(Number.isFinite)) throw new Error("Scoring weights must be finite.");
  const minimum = constraints.adaShieldMinimum;
  if (minimum !== undefined && (!Number.isSafeInteger(minimum) || minimum < 0)) throw new Error("Ada minimum must be a nonnegative whole troop count.");
  if (constraints.troopCounts && (constraints.troopCounts.length !== 3 || !constraints.troopCounts.every((c, t) => validTroopCounts(c, ratios[t])))) throw new Error("Enter three actual troop counts matching each ratio (within one troop of rounding), with positive totals.");
  if (minimum !== undefined && !constraints.troopCounts) throw new Error("Actual troop counts are required to check the pending Ada minimum.");
  const eligibleCount = roster.length;
  roster = roster.filter(hero => hero.class && heroClasses.includes(hero.class.value));
  for (const heroClass of heroClasses) {
    if (roster.filter(h => h.class?.value === heroClass).length < 3) throw new Error(`At least three owned eligible ${heroClass} heroes with configured classes are required. Unknown classes are excluded.`);
  }
  roster = [...roster].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const contributions = Array.from({ length: 9 }, (_, slot) => roster.map(hero => {
    const position = positions[slot % 3];
    return rules.heroPositionPoints?.[hero.id]?.[position] ?? 0;
  }));
  const troopPoints = ratios.map((ratio, t) => ({
    shield: ratio.shield * (rules.teamTroopWeights?.[t]?.shield ?? 0),
    bomber: ratio.bomber * (rules.teamTroopWeights?.[t]?.bomber ?? 0),
    shooter: ratio.shooter * (rules.teamTroopWeights?.[t]?.shooter ?? 0),
  }));
  function breakdown(order: number[]): Triple<TeamBreakdown> {
    return ratios.map((_, t) => {
      const positionPoints = Object.fromEntries(positions.map((p, i) => [p, contributions[t * 3 + i][order[t * 3 + i]]])) as Record<Position, number>;
      const troop = troopPoints[t];
      const total = Object.values(positionPoints).reduce((a, b) => a + b, 0) + troop.shield + troop.bomber + troop.shooter;
      return { positionPoints, troopPoints: { ...troop }, total };
    }) as Triple<TeamBreakdown>;
  }
  const { best: selections, expandedStates, consideredCount } = exactClassSearch(roster, contributions, (index, slot) =>
    !(roster[index].id === "Ada" && minimum !== undefined && constraints.troopCounts![Math.floor(slot / 3)].shield < minimum));
  if (!selections.length) throw new Error("No legal formations found under class and actual troop-count constraints. The starting 0% Shieldbearer ratios cannot satisfy a positive Ada minimum; adjust ratios/counts, disable the pending rule, or use another hero.");
  const best = selections.map(candidate => {
    const score = breakdown(candidate.order).reduce((sum, team) => sum + team.total, 0);
    if (!Number.isFinite(score)) throw new Error("Scoring overflow: reduce configured weights.");
    return { ...candidate, score };
  }).sort((a, b) => b.score - a.score);
  return best.map(candidate => ({
    id: JSON.stringify(candidate.order.map(i => roster[i].id)),
    teams: ratios.map((ratio, t) => ({
      heroes: Object.fromEntries(positions.map((p, i) => [p, structuredClone(roster[candidate.order[t * 3 + i]])])) as Record<Position, Hero>,
      ratio: { ...ratio },
      ...(constraints.troopCounts ? { troopCounts: { ...constraints.troopCounts[t] } } : {}),
    })) as Triple<Team>,
    score: candidate.score,
    scoreKind: "heuristic-not-damage",
    constraints: { adaShieldMinimum: minimum ?? null, verification: "pending", troopCountSource: constraints.troopCounts ? "player-entered" : "not-provided" },
    search: { strategy: "exact-additive-class-assignment", ...SEARCH_LIMITS, eligibleCount, consideredCount, expandedStates, optimalityGuaranteed: true },
    breakdown: { teams: breakdown(candidate.order), total: candidate.score },
    warnings: ["Heuristic points are not actual damage.", ...roster.map(h => `${h.name}: hero skills, stats, season availability, and Gorilla mechanics are unverified.`)],
  }));
}
