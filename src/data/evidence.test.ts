import { expect, it } from "vitest";
import evidence from "../../public/hero-evidence.json";
import { heroCatalog } from "./catalog";
import { catalogWithEvidence, communityExplanation, communityReference, communityScoringRules, communityTier, heroEvidence } from "./evidence";
import { eligibleHeroes, saveProfile, loadProfiles } from "../profiles";
import { systemProfile, systemStorage } from "../test/system-fixtures";
import { classifiedFixture } from "../test/fixtures";
import { eventData } from "./events";
import { generateEventFormations } from "../event-engine";

it("traces reviewed classes and seasons to evidence while retaining unknowns and original data", () => {
  expect(evidence.heroes).toHaveLength(27);
  expect(new Set(evidence.heroes.map(h => h.heroId)).size).toBe(27);
  const enriched = catalogWithEvidence(heroCatalog);
  expect(enriched.find(h => h.id === "Ada")?.class?.value).toBe("Shooter");
  expect(enriched.find(h => h.id === "Ada")?.seasonAvailability).toMatchObject({ from: 5, verification: "source-observed" });
  expect(enriched.find(h => h.id === "Flameborne")?.class?.value).toBe("Bomber");
  expect(heroCatalog.every(h => h.id === "Iwado" ? h.class?.value === "Shieldbearer" : ["Lunarl", "Flameborne"].includes(h.id) ? h.class?.value === "Bomber" : h.class === null)).toBe(true);
  expect(heroEvidence("Ada")?.skills.find(s => s.name === "Continuous Destruction")?.trigger).toContain("Shieldbearer or Bomber");
  expect(heroEvidence("Ada")?.exclusiveEquipment?.name).toBe("Sweet Kiss");
  expect(heroEvidence("Ada")?.exclusiveEquipment?.levelEffects).toBeNull();
  expect(heroEvidence("Ada")?.skills.every(s => s.values === null)).toBe(true);
  expect(heroEvidence("Flameborne")).toBeNull();
});
it("preserves ownership, stars, skills, equipment and local overrides across evidence updates", () => {
  const profile = systemProfile(), before = structuredClone(profile);
  const storage = systemStorage(); saveProfile(storage, profile);
  const enriched = catalogWithEvidence(heroCatalog);
  const eligible = eligibleHeroes(profile, enriched);
  expect(eligible).toHaveLength(9);
  expect(profile).toEqual(before);
  expect(loadProfiles(storage).profiles[0]).toEqual(before);
  const explicit = [{ ...heroCatalog[0], class: { value: "Bomber" as const, source: "https://example.invalid/explicit-fixture" } }];
  expect(catalogWithEvidence(explicit)[0].class?.value).toBe("Bomber");
});
it("keeps community tiers provisional, configurable, distinct from effects and unresolved names", () => {
  expect(communityReference.status).toBe("provisional-community-opinion");
  expect(communityTier("Ada")).toBe("S"); expect(communityTier("Lunarl")).toBe("S"); expect(communityTier("Iwakado")).toBeNull();
  expect(communityExplanation(["Caesar", "Lunarl"]).map(e => [e.tier, e.points])).toEqual([["D", 0], ["S", 4]]);
  expect(communityExplanation(["Iwakado"])[0].explanation).toContain("no inferred weakness");
  const base = { heroPositionPoints: { Ada: { Left: 2 } } };
  const next = communityScoringRules(base, { S: 10, A: 7, B: 4, C: 1, D: 0 });
  expect(next.heroPositionPoints?.Ada.Left).toBe(12); expect(base.heroPositionPoints.Ada.Left).toBe(2);
  expect(() => communityScoringRules({}, { S: NaN, A: 1, B: 1, C: 1, D: 0 })).toThrow(/finite/);
});
for (const event of eventData.events) it(`explains provisional scoring for ${event.id} without a daily damage multiplier`, () => {
  const results = generateEventFormations({ profile: systemProfile(), event, ratios: { mode: "Shared", ratio: { shield: 0, bomber: 20, shooter: 80 } }, troopCounts: [{ shield: 0, bomber: 20000, shooter: 80000 }, { shield: 0, bomber: 20000, shooter: 80000 }, { shield: 0, bomber: 20000, shooter: 80000 }], catalog: classifiedFixture, adaShieldMinimum: null, useCommunityRankings: true });
  expect(results[0].score).toBe(33);
  expect(results[0].communityRanking).toHaveLength(9);
  expect(results[0].breakdown.total).toBe(33);
  expect(results[0].eventBonusScoring).toBe("unknown-not-applied");
});


it("matches audited guide tier lists to canonical identities without applying group guesses", async () => {
  const { validateGuideRankings } = await import("./evidence");
  const expected = {
    S: ["Tyronn", "Phoenix", "Xuanming", "Lunarl", "Flameborne", "Worrell", "Alph", "Ada", "Drake", "Veronica"],
    A: ["Marcus", "Ryuichi Ito", "Whisper", "Wukong", "Koschevoi", "Mireya", "Lofili", "Kate", "Sawyer"],
    B: ["Otto", "Samir", "Vivian", "Edwin", "Devilian", "Inata"],
    C: ["Zoltan", "Ekko"], D: ["Tormund", "Caesar", "Gerd", "Iwado", "Vesaryon", "Gimes", "Mia", "Flora", "Platos"],
  };
  for (const [tier, ids] of Object.entries(expected)) expect(communityReference.rankings.filter(e => e.tier === tier).map(e => e.heroId).sort()).toEqual(ids.sort());
  expect(validateGuideRankings(communityReference.rankings, heroCatalog)).toHaveLength(36);
  expect(communityTier("Lunari")).toBeNull(); expect(communityTier("Lunarl")).toBe("S");
  expect(communityTier("Iwado")).toBe("D"); expect(communityTier("Iwakado")).toBeNull();
  expect(communityTier("Harton")).toBeNull();
  expect(() => validateGuideRankings([{ heroId: "Lunari", tier: "S" }], heroCatalog)).toThrow(/unmatched/);
  expect(() => validateGuideRankings([{ heroId: "Ada", tier: "S" }, { heroId: "Ada", tier: "A" }], heroCatalog)).toThrow(/duplicate/);
  expect(() => validateGuideRankings([{ heroId: "Ada", tier: "Unknown" }], heroCatalog)).toThrow(/Invalid/);
});
