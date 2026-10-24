import { expect, it } from "vitest";
import { canonical, emptyBattle, type Battle } from "./battles";
import { eventData } from "./data/events";
import { allocateTroops, matchingObservationIndex, optimizeAttack, OPTIMIZATION_LIMITS, ratioCandidates } from "./optimization";
import { validFormation, validRatio, validTroopCounts, type RatioMode, type Triple } from "./engine";
import { generateEventFormations } from "./event-engine";
import { systemProfile } from "./test/system-fixtures";
import { classifiedFixture } from "./test/fixtures";
const totals: Triple<number> = [100000, 100000, 100000];
const shared: RatioMode = { mode: "Shared", ratio: { shield: 0, bomber: 20, shooter: 80 } };

it("allocates planned counts deterministically with preserved totals and bounded rounding", () => {
  const ratio = { shield: 1, bomber: 9, shooter: 90 };
  expect(allocateTroops(100000, ratio)).toEqual({ shield: 1000, bomber: 9000, shooter: 90000 });
  const counts = allocateTroops(99999, ratio);
  expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(99999);
  expect(validTroopCounts(counts, ratio)).toBe(true);
  expect(() => allocateTroops(0, ratio)).toThrow(/positive/);
});
for (const event of eventData.events) for (const mode of ["Shared", "Independent"] as const) it(`compares bounded ${mode} candidates for ${event.id}`, () => {
  const ratios: RatioMode = mode === "Shared" ? shared : { mode, ratios: [shared.ratio, shared.ratio, shared.ratio] };
  const request = { profile: systemProfile(), event, ratios, teamTotals: totals, adaShieldMinimum: null, catalog: classifiedFixture };
  const first = optimizeAttack(request), second = optimizeAttack(request);
  expect(first).toEqual(second);
  expect(first.plans).toHaveLength(5);
  expect(first.examinedRatioConfigurations).toBeLessThanOrEqual(OPTIMIZATION_LIMITS.ratioConfigurations);
  expect(first.examinedRobotConfigurations).toBeLessThanOrEqual(OPTIMIZATION_LIMITS.robotConfigurations);
  expect(first.plans.every(plan => validFormation(plan.formation))).toBe(true);
  expect(first.plans.every(plan => plan.observedMeanDamage === null && plan.countsStatus === "planned-confirm-in-game")).toBe(true);
  expect(first.plans[0].guideDistance).toBe(0);
  expect(first.plans[0].formation.constraints.troopCountSource).toBe("planned-from-total");
  expect(first.optimalityGuaranteed).toBe(false);
});
it("searches independent team combinations and satisfies Ada using actual planned counts", () => {
  const p = systemProfile(), event = eventData.events[1];
  const current: RatioMode = { mode: "Independent", ratios: [{ shield: 0, bomber: 10, shooter: 90 }, { shield: 0, bomber: 10, shooter: 90 }, { shield: 0, bomber: 10, shooter: 90 }] };
  const candidates = ratioCandidates(event, current, totals, 1000);
  expect(candidates.some(c => c.mode === "Independent" && canonical(c.ratios[0]) !== canonical(c.ratios[1]))).toBe(true);
  expect(candidates.every(c => (c.mode === "Shared" ? [c.ratio] : c.ratios).every(validRatio))).toBe(true);
  const result = optimizeAttack({ profile: p, event, ratios: current, teamTotals: totals, catalog: classifiedFixture, adaShieldMinimum: 1000 });
  for (const plan of result.plans) {
    expect(validFormation(plan.formation)).toBe(true);
    const team = plan.formation.teams.find(t => Object.values(t.heroes).some(h => h.id === "Ada"))!;
    expect(team.troopCounts!.shield).toBeGreaterThanOrEqual(1000);
  }
});
it("uses only exact matching individual observations and separates observed damage from heuristic score", () => {
  const profile = systemProfile(), event = eventData.events[0];
  const ratio = { shield: 0, bomber: 19, shooter: 81 };
  const troopCounts = totals.map(total => allocateTroops(total, ratio)) as Triple<ReturnType<typeof allocateTroops>>;
  const f = generateEventFormations({ profile, event, ratios: { mode: "Shared", ratio }, troopCounts, catalog: classifiedFixture, adaShieldMinimum: null })[0];
  const observed = emptyBattle("synthetic-observation", profile.serverNumber!, event.id);
  Object.assign(observed, { profileId: profile.id, playerName: profile.name, date: "2026-10-24", damage: 555, attackKind: "individual", attackCount: 1, progressionSnapshot: profile, troopCounts, robotIds: [null, null, null], ratios: { mode: "Shared", ratio }, formation: f.teams.map(t => ({ Left: t.heroes.Left.id, Middle: t.heroes.Middle.id, Right: t.heroes.Right.id })) });
  const total = { ...observed, id: "five", damage: 999999, attackKind: "five-attack-total", attackCount: 5 } as Battle;
  const missing = { ...observed, id: "missing", damage: 999999, progressionSnapshot: null };
  const different = { ...observed, id: "different", damage: 999999, server: 260 };
  const result = optimizeAttack({ profile, event, ratios: shared, teamTotals: totals, catalog: classifiedFixture, adaShieldMinimum: null, records: [observed, total, missing, different] });
  expect(result.plans[0].observedMeanDamage).toBe(555);
  expect(result.plans[0].observationCount).toBe(1);
  expect(result.plans[0].formation.score).toBe(33);
  expect(result.plans[0].ratios).toEqual({ mode: "Shared", ratio });
  expect(matchingObservationIndex([total, missing, different], profile, event.id).size).toBe(0);
});
it("does not change the player's roster or progression while exploring robot and ratio candidates", () => {
  const profile = systemProfile(); profile.ownedRobots = [{ robotId: "Fixture robot", level: 20, cores: { module: null }, upgrades: { custom: 3 } }];
  const before = structuredClone(profile);
  const result = optimizeAttack({ profile, event: eventData.events[0], ratios: shared, teamTotals: totals, adaShieldMinimum: null, catalog: classifiedFixture });
  expect(profile).toEqual(before);
  expect(result.plans.every(p => p.robots.every(id => id === null || id === "Fixture robot"))).toBe(true);
  expect(result.plans.every(p => p.robotEffects.every(t => t.applied.length === 0))).toBe(true);
});

it("optimizes valid percentage combinations in both modes without allocating fictional troop counts", () => {
  for (const mode of ["Shared", "Independent"] as const) {
    const ratio = { shield: 0, bomber: 20, shooter: 80 };
    const ratios = mode === "Shared" ? { mode, ratio } : { mode, ratios: [ratio, ratio, ratio] as Triple<typeof ratio> };
    const request = { profile: systemProfile(), event: eventData.events[0], ratios, catalog: classifiedFixture };
    const result = optimizeAttack(request);
    expect(result).toEqual(optimizeAttack(request));
    expect(result.plans).toHaveLength(5);
    for (const plan of result.plans) {
      expect(plan.troopCounts).toBeNull(); expect(plan.countsStatus).toBe("not-provided");
      expect(plan.observedMeanDamage).toBeNull();
      expect(plan.formation.teams.every(t => !t.troopCounts && t.ratio.shield + t.ratio.bomber + t.ratio.shooter === 100)).toBe(true);
    }
    expect(result.examinedRatioConfigurations).toBeGreaterThan(1);
    expect(result.examinedRatioConfigurations).toBeLessThanOrEqual(24);
  }
});

it("ignores owned robot progression and assignments in non-robot event rankings across all seven events", () => {
  for (const event of eventData.events) {
    const profile = systemProfile(); profile.ownedRobots = [{ robotId: "Fixture robot", upgrades: { x: 99 }, level: 10 }]; profile.teamRobotIds = ["Fixture robot", null, null];
    const before = structuredClone(profile);
    const request = { profile, event, ratios: shared, catalog: classifiedFixture };
    const result = optimizeAttack(request);
    expect(profile).toEqual(before);
    if (!["cyber", "warlord"].includes(event.id)) {
      const other = structuredClone(profile); other.ownedRobots = []; other.teamRobotIds = [null, null, null];
      expect(result).toEqual(optimizeAttack({ ...request, profile: other }));
      expect(result.examinedRobotConfigurations).toBe(1);
      expect(result.plans.every(p => p.robots.every(id => id === null) && p.robotEffects.every(t => t.applied.length === 0))).toBe(true);
    } else expect(result.examinedRobotConfigurations).toBeGreaterThan(1);
  }
});

it("explains Space zero points independently of robots and applies only explicit configurable heuristic weights", () => {
  const profile = systemProfile(), event = eventData.events[0];
  const request = { profile, event, catalog: classifiedFixture, useCommunityRankings: false };
  const plain = generateEventFormations(request);
  expect(plain.every(f => f.score === 0 && f.breakdown.teams.every(t => t.total === 0))).toBe(true);
  profile.ownedRobots = [{ robotId: "Fixture robot", level: 100, upgrades: { x: 100 } }]; profile.teamRobotIds = ["Fixture robot", null, null];
  expect(generateEventFormations(request)).toEqual(plain);
  expect(generateEventFormations({ ...request, rules: { heroPositionPoints: { Ada: { Right: 7 } } } })[0].score).toBe(7);
  expect(generateEventFormations({ ...request, useCommunityRankings: true })[0].score).toBeGreaterThan(0);
});

it("ignores historical robot snapshots when matching a non-robot event observation", () => {
  const profile = systemProfile(), event = eventData.events[0], ratio = { shield: 0, bomber: 20, shooter: 80 };
  const counts = totals.map(t => allocateTroops(t, ratio)) as Triple<ReturnType<typeof allocateTroops>>;
  const f = generateEventFormations({ profile, event, catalog: classifiedFixture, ratios: { mode: "Shared", ratio } })[0];
  const record = emptyBattle("legacy-robots", profile.serverNumber!, event.id);
  const oldProfile = structuredClone(profile); oldProfile.ownedRobots = [{ robotId: "Legacy robot", upgrades: { old: 1 } }];
  Object.assign(record, { profileId: profile.id, date: "2026-10-24", damage: 123, attackKind: "individual", attackCount: 1, progressionSnapshot: oldProfile, troopCounts: counts, robotIds: ["Legacy robot", null, null], ratios: { mode: "Shared", ratio }, formation: f.teams.map(t => ({ Left: t.heroes.Left.id, Middle: t.heroes.Middle.id, Right: t.heroes.Right.id })) });
  const before = structuredClone(record);
  const index = matchingObservationIndex([record], profile, event.id);
  profile.ownedRobots = [{ robotId: "Other robot", upgrades: { new: 99 }, level: 55 }]; profile.teamRobotIds = [null, "Other robot", null];
  expect(matchingObservationIndex([record], profile, event.id)).toEqual(index);
  expect(index.size).toBe(1); expect(record).toEqual(before);
});
