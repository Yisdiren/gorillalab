import { expect, it } from "vitest";
import { assessRanking } from "./ranking";
import { generateEventFormations } from "./event-engine";
import { eventData } from "./data/events";
import { systemProfile } from "./test/system-fixtures";
import { classifiedFixture } from "./test/fixtures";
import { validFormation } from "./engine";

it("reports equal guide-tier sums as tied, not a meaningful recommendation", () => {
  const results = generateEventFormations({ profile: systemProfile(), event: eventData.events[0], catalog: classifiedFixture });
  expect(results.every(f => f.score === 33)).toBe(true);
  expect(assessRanking(results)).toMatchObject({ meaningful: false, tied: 5, unknown: 0 });
  expect(assessRanking(results).reason).toContain("deterministic");
});
it("supports default provisional scores and explicit opt-out in every event and percentage mode without mutations", () => {
  const profile = systemProfile(), before = structuredClone(profile);
  for (const event of eventData.events) for (const mode of ["Shared", "Independent"] as const) {
    const ratio = event.startingRatio;
    const ratios = mode === "Shared" ? { mode, ratio } : { mode, ratios: [ratio, ratio, ratio] as [typeof ratio, typeof ratio, typeof ratio] };
    const request = { profile, event, catalog: classifiedFixture, ratios };
    const results = generateEventFormations(request);
    expect(results.every(f => f.score === 33 && validFormation(f))).toBe(true);
    expect(results.every(f => f.teams.every(t => t.ratio.shield + t.ratio.bomber + t.ratio.shooter === 100))).toBe(true);
    expect(generateEventFormations({ ...request, useCommunityRankings: false }).every(f => f.score === 0 && !f.communityRanking)).toBe(true);
  }
  expect(profile).toEqual(before);
});
it("keeps unknown information separate from D and explains partial confidence", () => {
  const result = generateEventFormations({ profile: systemProfile(), event: eventData.events[0], catalog: classifiedFixture });
  const partial = structuredClone(result);
  partial[0].communityRanking![0].tier = null; partial[1].score = 0;
  expect(assessRanking(partial)).toMatchObject({ meaningful: false, unknown: 1 });
  expect(assessRanking(partial).reason).toContain("Unknown does not mean weak");
});
it("recognizes a highest score while explicitly explaining tied first-place ordering", () => {
  const result = generateEventFormations({ profile: systemProfile(), event: eventData.events[0], catalog: classifiedFixture });
  result[4].score = 32; // Presentation assessment fixture, not a combat calculation.
  expect(assessRanking(result)).toMatchObject({ meaningful: true, tied: 4 });
  expect(assessRanking(result).reason).toContain("share first place");
  expect(assessRanking([]).meaningful).toBe(false);
});

it("selects stronger source-tier preferences from a larger eligible owned pool without guessing position advantages", async () => {
  const { heroCatalog } = await import("./data/catalog");
  const profile = systemProfile(); const catalog = structuredClone([...classifiedFixture]);
  for (const id of ["Alph", "Gimes"]) {
    // Synthetic class/season eligibility for engine coverage, not new catalog evidence.
    catalog.push({ ...heroCatalog.find(h => h.id === id)!, class: { value: "Bomber", source: "https://example.invalid/test" } });
    profile.ownedHeroes.push({ heroId: id, stars: null, skillLevels: {}, equipment: [] });
    profile.seasonOverrides[id] = { from: 1, verification: "unverified" };
  }
  const before = structuredClone(profile);
  const result = generateEventFormations({ profile, event: eventData.events[0], catalog });
  expect(result[0].score).toBeGreaterThan(33);
  expect(result.every(f => validFormation(f))).toBe(true);
  expect(result[0].communityRanking?.find(e => e.heroId === "Alph")?.tier).toBe("S");
  expect(result[0].communityRanking?.some(e => e.heroId === "Gimes")).toBe(false);
  expect(profile).toEqual(before);
});

it("does not treat an omitted eligible Unknown hero as proven weaker than the returned candidates", () => {
  const profile = systemProfile();
  const extra = { ...classifiedFixture[0], id: "Harton", name: "Harton" };
  profile.ownedHeroes.push({ heroId: "Harton", stars: null, skillLevels: {}, equipment: [] });
  profile.seasonOverrides.Harton = { from: 1, verification: "unverified" };
  const results = generateEventFormations({ profile, event: eventData.events[0], catalog: [...classifiedFixture, extra] });
  expect(results[0].guideCoverage?.unknownHeroIds).toEqual(["Harton"]);
  expect(results[0].communityRanking?.some(e => e.heroId === "Harton")).toBe(false);
  results[4].score = results[0].score - 1; // Ensure unknown evidence, not a tie, prevents recommendation.
  expect(assessRanking(results)).toMatchObject({ meaningful: false, unknown: 1 });
  expect(assessRanking(results).reason).toContain("eligible candidate heroes");
});
