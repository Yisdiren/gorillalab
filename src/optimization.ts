import { canonical, type Battle } from "./battles";
import { eventData, type GorillaEvent } from "./data/events";
import { heroCatalog, type Hero } from "./data/catalog";
import { generateEventFormations, type EventFormation } from "./event-engine";
import { positions, validRatio, type RatioMode, type Triple, type TroopCounts, type TroopRatio } from "./engine";
import { validateProfile, type PlayerProfile } from "./profiles";
import { robotAssignmentCandidates, robotEffects, robotsEnabledForEvent, type RobotReuse } from "./robots";
import { catalogWithEvidence } from "./data/evidence";

export const OPTIMIZATION_LIMITS = { ratioConfigurations: 24, robotConfigurations: 8 } as const;
export function allocateTroops(total: number, ratio: TroopRatio): TroopCounts {
  if (!Number.isSafeInteger(total) || total <= 0 || !validRatio(ratio)) throw new Error("Enter positive whole team totals and valid 100% ratios.");
  const keys = ["shield", "bomber", "shooter"] as const;
  const raw = keys.map(key => total * ratio[key] / 100);
  const values = raw.map(Math.floor);
  const remainder = total - values.reduce((a, b) => a + b, 0);
  const order = raw.map((value, i) => ({ i, part: value - values[i] })).sort((a, b) => b.part - a.part);
  for (let i = 0; i < remainder; i++) values[order[i % 3].i]++;
  return { shield: values[0], bomber: values[1], shooter: values[2] };
}
function ratioTuple(mode: RatioMode): Triple<TroopRatio> { return mode.mode === "Shared" ? [{ ...mode.ratio }, { ...mode.ratio }, { ...mode.ratio }] : structuredClone(mode.ratios); }
function progression(profile: PlayerProfile, eventId: string) { const copy = structuredClone(profile); delete copy.teamRobotIds; if (!robotsEnabledForEvent(eventId)) copy.ownedRobots = []; return canonical(copy); }
export function matchingObservationIndex(records: readonly Battle[], profile: PlayerProfile, eventId: string) {
  const index = new Map<string, number[]>();
  const profileProgression = progression(profile, eventId);
  for (const b of records) {
    if (b.server !== profile.serverNumber || b.profileId !== profile.id || b.eventId !== eventId || b.attackKind !== "individual" || b.date === null || !b.progressionSnapshot || progression(b.progressionSnapshot, eventId) !== profileProgression || !b.formation || !b.ratios || b.ratios.mode === "unknown" || !b.troopCounts || (robotsEnabledForEvent(eventId) && !b.robotIds)) continue;
    const key = canonical({ formation: b.formation, ratios: ratioTuple(b.ratios), counts: b.troopCounts, robots: robotsEnabledForEvent(eventId) ? b.robotIds : [null, null, null] });
    index.set(key, [...index.get(key) ?? [], b.damage]);
  }
  return index;
}
export function ratioCandidates(event: GorillaEvent, current: RatioMode, totals: Triple<number> | undefined, minimum: number | null, records: readonly Battle[] = [], profile?: PlayerProfile): RatioMode[] {
  const candidates: RatioMode[] = []; const seen = new Set<string>();
  const add = (tuple: Triple<TroopRatio>) => {
    if (!tuple.every(validRatio) || candidates.length >= OPTIMIZATION_LIMITS.ratioConfigurations) return;
    if (current.mode === "Shared" && tuple.some(r => canonical(r) !== canonical(tuple[0]))) return;
    const key = canonical(tuple); if (seen.has(key)) return; seen.add(key);
    candidates.push(current.mode === "Shared" ? { mode: "Shared", ratio: { ...tuple[0] } } : { mode: "Independent", ratios: structuredClone(tuple) });
  };
  const start = ratioTuple(current); add(start);
  add([{ ...event.startingRatio }, { ...event.startingRatio }, { ...event.startingRatio }]);
  const profileProgression = profile ? progression(profile, event.id) : null;
  if (profile) for (const b of records) {
    if (b.server === profile.serverNumber && b.profileId === profile.id && b.eventId === event.id && b.attackKind === "individual" && b.progressionSnapshot && progression(b.progressionSnapshot, event.id) === profileProgression && b.ratios && b.ratios.mode !== "unknown") add(ratioTuple(b.ratios));
    if (candidates.length >= 10) break;
  }
  const shields = [...new Set([0, ...(minimum === null ? [] : (totals ? totals.map(total => Math.ceil(minimum / total * 10000) / 100) : [1, 5]))])].filter(s => s <= 100);
  const options = [0, -1, 1, -5, 5, -10, 10].flatMap(delta => shields.map(shield => {
    const bomber = Math.min(100 - shield, Math.max(0, event.startingRatio.bomber + delta));
    return { shield, bomber, shooter: 100 - (shield + bomber) };
  }));
  for (const option of options) {
    if (current.mode === "Shared") add([{ ...option }, { ...option }, { ...option }]);
    else {
      for (let team = 0; team < 3; team++) { const tuple = structuredClone(start); tuple[team] = { ...option }; add(tuple); }
      add([{ ...option }, { ...option }, { ...option }]);
    }
  }
  return candidates;
}
export type OptimizationPlan = {
  formation: EventFormation; ratios: RatioMode; troopCounts: Triple<TroopCounts> | null; robots: Triple<string | null>;
  robotEffects: ReturnType<typeof robotEffects>; observedMeanDamage: number | null; observationCount: number;
  guideDistance: number; explanation: string; countsStatus: "planned-confirm-in-game" | "not-provided";
};
export function optimizeAttack(request: {
  profile: PlayerProfile; event: GorillaEvent; ratios: RatioMode; teamTotals?: Triple<number>;
  adaShieldMinimum?: number | null; useCommunityRankings?: boolean; robotReuse?: RobotReuse;
  records?: readonly Battle[]; catalog?: readonly Hero[];
}) {
  if (!validateProfile(request.profile)) throw new Error("Invalid profile progression.");
  if (request.teamTotals && (request.teamTotals.length !== 3 || !request.teamTotals.every(n => Number.isSafeInteger(n) && n > 0))) throw new Error("Enter a positive whole troop total for each of the three teams.");
  const minimum = request.adaShieldMinimum === undefined ? eventData.adaShieldRule.minimumShieldbearers : request.adaShieldMinimum;
  if (minimum !== null && (!Number.isSafeInteger(minimum) || minimum < 0)) throw new Error("Invalid Ada minimum.");
  const configurations = ratioCandidates(request.event, request.ratios, request.teamTotals, minimum, request.records, request.profile);
  const robotPlans: Triple<string | null>[] = robotsEnabledForEvent(request.event.id) ? robotAssignmentCandidates(request.profile, request.robotReuse, OPTIMIZATION_LIMITS.robotConfigurations) : [[null, null, null]];
  const observations = matchingObservationIndex(request.records ?? [], request.profile, request.event.id);
  const catalog = request.catalog ?? catalogWithEvidence(heroCatalog);
  const plans: OptimizationPlan[] = [], rejected: string[] = [];
  const seen = new Set<string>();
  for (const ratios of configurations) {
    const tuple = ratioTuple(ratios);
    const totals = request.teamTotals;
    const troopCounts = totals ? tuple.map((r, team) => allocateTroops(totals[team], r)) as Triple<TroopCounts> : null;
    let formations: EventFormation[];
    try { formations = generateEventFormations({ profile: request.profile, event: request.event, ratios, ...(troopCounts ? { troopCounts } : {}), catalog, useCommunityRankings: request.useCommunityRankings, adaShieldMinimum: minimum }); }
    catch (error) { rejected.push(error instanceof Error ? error.message : String(error)); continue; }
    for (const f of formations) for (const robots of robotPlans) {
      const formation = structuredClone(f); formation.constraints.troopCountSource = troopCounts ? "planned-from-total" : "not-provided";
      const ids = formation.teams.map(t => Object.fromEntries(positions.map(p => [p, t.heroes[p].id])));
      const key = canonical({ formation: ids, ratios: tuple, counts: troopCounts, robots });
      if (seen.has(key)) continue; seen.add(key);
      const damage = observations.get(key) ?? [];
      const mean = damage.length ? damage.reduce((average, value, index) => average + (value - average) / (index + 1), 0) : null;
      plans.push({ formation, ratios: structuredClone(ratios), troopCounts: structuredClone(troopCounts), robots: [...robots], robotEffects: robotEffects(request.profile, robots, request.event.id), observedMeanDamage: mean, observationCount: damage.length,
        guideDistance: tuple.reduce((sum, r) => sum + Math.abs(r.shield - request.event.startingRatio.shield) + Math.abs(r.bomber - request.event.startingRatio.bomber) + Math.abs(r.shooter - request.event.startingRatio.shooter), 0),
        explanation: mean === null ? "No matching individual battle observations. Ranked by explicit heuristic points, then proximity to the guide baseline. No damage-optimal ratio or robot is known." : "Matching individual observations for this server, player, event, formation, ratios, counts, robots and progression. Observed mean is not predicted damage; randomness and unrecorded conditions remain.", countsStatus: troopCounts ? "planned-confirm-in-game" : "not-provided" });
    }
  }
  plans.sort((a, b) => Number(b.observationCount > 0) - Number(a.observationCount > 0) || (b.observedMeanDamage ?? 0) - (a.observedMeanDamage ?? 0) || b.formation.score - a.formation.score || a.guideDistance - b.guideDistance);
  if (!plans.length) throw new Error(rejected[0] ?? "No feasible plans under the current constraints.");
  return { plans: plans.slice(0, 5), examinedRatioConfigurations: configurations.length, examinedRobotConfigurations: robotPlans.length, rejectedConfigurations: rejected.length, limits: OPTIMIZATION_LIMITS, optimalityGuaranteed: false as const, warnings: ["Candidate percentages are test recommendations, not a proven damage optimum. Count-dependent effects remain unverified without actual counts.", "Only matching individual local observations influence empirical ranking; five-attack totals and missing metadata are excluded.", "Robot reuse is unknown unless explicitly configured by the player. No undocumented robot bonuses or +1000% damage multipliers are applied."] };
}
