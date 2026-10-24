import { expect, it } from "vitest";
import { heroCatalog } from "./data/catalog";
import { catalogWithEvidence, communityTier } from "./data/evidence";
import { generateEventFormations, startingRatios } from "./event-engine";
import { eventData } from "./data/events";
import { createProfile, eligibilityReport } from "./profiles";
import { positions, validFormation } from "./engine";

const catalog = catalogWithEvidence(heroCatalog);
function confirmedProfile() {
  const profile = createProfile("confirmed-bombers-test", "Confirmed Bomber regression fixture");
  profile.currentSeason = 6;
  profile.ownedHeroes = ["Ada", "Tyronn", "Alph", "Phoenix", "Drake", "Worrell", "Xuanming", "Veronica", "Ryuichi Ito", "Lunarl", "Flameborne"].map(heroId => ({ heroId, stars: ({ Lunarl: 5, Flameborne: 4, Worrell: 3, Alph: 4, "Ryuichi Ito": 5 } as Record<string, number>)[heroId] ?? null, skillLevels: { retained: 3 }, equipment: [{ name: "Preserve", level: 2 }] }));
  return profile;
}
it("discovers three eligible S Bombers instead of an A Bomber for the confirmed player pool", () => {
  const profile = confirmedProfile(), before = structuredClone(profile), event = eventData.events[0];
  for (const id of ["Lunarl", "Flameborne", "Worrell", "Alph"]) { expect(communityTier(id)).toBe("S"); expect(catalog.find(h => h.id === id)?.class?.value).toBe("Bomber"); }
  expect(communityTier("Lunari")).toBeNull(); expect(catalog.filter(h => h.id === "Lunarl")).toHaveLength(1);
  const old = structuredClone(profile); old.ownedHeroes = old.ownedHeroes.filter(h => !["Lunarl", "Flameborne"].includes(h.heroId));
  expect(generateEventFormations({ profile: old, event, catalog })[0].score).toBe(35);
  for (const mode of ["Shared", "Independent"] as const) {
    const result = generateEventFormations({ profile, event, catalog, ratios: startingRatios(event, mode) });
    expect(result).toHaveLength(5);
    for (const formation of result) {
      expect(formation.score).toBe(36); expect(formation.breakdown.total).toBe(36);
      expect(formation.communityRanking).toHaveLength(9);
      expect(formation.communityRanking?.every(h => h.tier === "S")).toBe(true);
      expect(validFormation(formation)).toBe(true);
      const heroes = formation.teams.flatMap(t => positions.map(p => t.heroes[p]));
      expect(new Set(heroes.map(h => h.id)).size).toBe(9);
      expect(heroes.filter(h => h.class?.value === "Bomber")).toHaveLength(3);
      expect(heroes.some(h => h.id === "Ryuichi Ito")).toBe(false);
      expect(formation.search.optimalityGuaranteed).toBe(true);
      expect(formation.teams.every(t => t.ratio.shield === 0 && t.ratio.bomber === 20 && t.ratio.shooter === 80)).toBe(true);
    }
  }
  expect(profile).toEqual(before);
});
it("is independent of catalog order, owned-list order and star levels under tier-only scoring", () => {
  const profile = confirmedProfile(), event = eventData.events[0];
  const result = generateEventFormations({ profile, event, catalog });
  const changed = structuredClone(profile); changed.ownedHeroes.reverse().forEach(h => { h.stars = h.heroId === "Ryuichi Ito" ? 5 : 0; });
  const other = generateEventFormations({ profile: changed, event, catalog: [...catalog].reverse() });
  expect(other.map(f => [f.id, f.score])).toEqual(result.map(f => [f.id, f.score]));
  expect(result[0].warnings.join(" ")).toContain("Included provisionally");
});
it("keeps unknown eligibility distinct from explicit season exclusions without inventing a season", () => {
  const profile = confirmedProfile();
  const report = eligibilityReport(profile, catalog);
  expect(report.find(h => h.heroId === "Lunarl")?.status).toBe("unknown");
  expect(report.find(h => h.heroId === "Flameborne")?.status).toBe("unknown");
  expect(catalog.find(h => h.id === "Lunarl")?.seasonAvailability).toBeNull();
  profile.seasonOverrides.Lunarl = { from: 7, verification: "unverified" };
  expect(eligibilityReport(profile, catalog).find(h => h.heroId === "Lunarl")?.status).toBe("ineligible");
  const result = generateEventFormations({ profile, event: eventData.events[0], catalog });
  expect(result.every(f => f.communityRanking?.every(h => h.heroId !== "Lunarl"))).toBe(true);
  expect(result[0].score).toBe(36);
  expect(result[0].warnings.join(" ")).toContain("Lunarl: Excluded: season 6");
});

it("returns the highest tier-only score first through both ratio optimizer modes", async () => {
  const { optimizeAttack } = await import("./optimization");
  const profile = confirmedProfile(), before = structuredClone(profile), event = eventData.events[0];
  for (const mode of ["Shared", "Independent"] as const) {
    const result = optimizeAttack({ profile, event, catalog, ratios: startingRatios(event, mode) });
    expect(result.plans[0].formation.score).toBe(36);
    expect(result.plans.every(plan => plan.formation.communityRanking?.every(h => h.tier === "S"))).toBe(true);
    expect(result.plans.map(p => p.formation.score)).toEqual(result.plans.map(p => p.formation.score).sort((a,b) => b-a));
    expect(result.plans.every(p => p.robots.every(id => id === null))).toBe(true);
  }
  expect(profile).toEqual(before);
});
