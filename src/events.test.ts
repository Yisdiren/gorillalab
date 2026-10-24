import { afterEach, describe, expect, it, vi } from "vitest";
import { bonusCategories, eventData, fetchEvents, parseEvents } from "./data/events";
import { generateEventFormations, startingRatios } from "./event-engine";
import { generateFormations, positions, validFormation, validTroopCounts, type Triple, type TroopCounts } from "./engine";
import { createProfile, eligibleHeroes, migrateProfiles, saveProfile, loadProfiles } from "./profiles";
import { classifiedFixture } from "./test/fixtures";
import { heroCatalog } from "./data/catalog";

const profile = () => {
  const p = createProfile("events", "Any server"); p.serverNumber = 24800; p.currentSeason = 1;
  p.ownedHeroes = classifiedFixture.map(h => ({ heroId: h.id, stars: null, skillLevels: {}, equipment: [] }));
  p.seasonOverrides = Object.fromEntries(classifiedFixture.map(h => [h.id, { from: 1, verification: "unverified" as const }]));
  return p;
};
const counts = (shield = 1000): TroopCounts => ({ shield, bomber: shield * 9, shooter: shield * 90 });
const triple = (value: TroopCounts): Triple<TroopCounts> => [{ ...value }, { ...value }, { ...value }];
const ratio = { shield: 1, bomber: 9, shooter: 90 };
afterEach(() => vi.unstubAllGlobals());

it("stores the seven exact guide events, bonuses and starting recommendations", () => {
  expect(eventData.events.map(e => [e.day, e.name, e.startingRatio.bomber, e.startingRatio.shooter])).toEqual([
    ["Monday", "Space Gorilla", 20, 80], ["Tuesday", "Wise Gorilla", 10, 90],
    ["Wednesday", "Cyber Gorilla", 10, 90], ["Thursday", "Primal Gorilla", 20, 80],
    ["Friday", "Armed Gorilla", 15, 85], ["Saturday", "Treasure Gorilla", 10, 90],
    ["Sunday", "Gorilla Warlord", 10, 90],
  ]);
  eventData.events.forEach((e, i) => {
    expect(e.startingRatio.shield).toBe(0);
    expect(e.mechanicsStatus).toBe("unknown");
    expect(e.ratioStatus).toBe("starting-recommendation-not-proven-optimum");
    if (i < 6) expect(e.bonuses).toEqual([{ category: ({space:"satellite",wise:"technology",cyber:"power-armor",primal:"tome",armed:"hero-equipment",treasure:"collection"} as Record<string,string>)[e.id], reportedBoostPercent: 1000, strength: "daily-boost", baseValue: null, damageMultiplier: null }]);
  });
  expect(eventData.events[6].bonuses).toEqual(bonusCategories.map(category => ({ category, reportedBoostPercent: 0, strength: "normal", baseValue: null, damageMultiplier: null })));
});

for (const event of eventData.events) {
  describe(event.name, () => {
    for (const mode of ["Shared", "Independent"] as const) {
      it(`supports ${mode} ratios and three teams with one of each class`, () => {
        const troopCounts = triple({ shield: 0, bomber: event.startingRatio.bomber * 1000, shooter: event.startingRatio.shooter * 1000 });
        const results = generateEventFormations({ profile: profile(), event, troopCounts, ratios: startingRatios(event, mode), catalog: classifiedFixture, adaShieldMinimum: null });
        expect(results).toHaveLength(5);
        expect(new Set(results.map(f => f.id)).size).toBe(5);
        for (const f of results) {
          expect(validFormation(f)).toBe(true);
          expect(f.teams).toHaveLength(3);
          for (const team of f.teams) {
            expect(positions.map(p => team.heroes[p].class!.value).sort()).toEqual(["Bomber", "Shieldbearer", "Shooter"]);
            expect(team.ratio).toEqual(event.startingRatio);
            expect(team.troopCounts).toEqual(troopCounts[0]);
          }
          expect(new Set(f.teams.flatMap(t => positions.map(p => t.heroes[p].id))).size).toBe(9);
          expect(f.event).toEqual(event);
          expect(f.score).toBe(33);
          expect(f.eventBonusScoring).toBe("unknown-not-applied");
        }
      });
    }
  });
}

it("never turns reported +1000% into a damage or score multiplier", () => {
  const results = eventData.events.map(event => generateEventFormations({ profile: profile(), event, troopCounts: triple(counts()), ratios: { mode: "Shared", ratio }, catalog: classifiedFixture, rules: { heroPositionPoints: { Ada: { Left: 7 } } } }));
  expect(results.map(r => r[0].score)).toEqual(Array(7).fill(40));
  results.forEach(r => expect(r[0].event.bonuses.every(b => b.damageMultiplier === null)).toBe(true));
});

it("checks actual Ada counts at 999 and 1000 despite identical percentages", () => {
  const base = { profile: profile(), event: eventData.events[1], ratios: { mode: "Shared" as const, ratio }, catalog: classifiedFixture };
  expect(validTroopCounts(counts(999), ratio)).toBe(true);
  expect(() => generateEventFormations({ ...base, troopCounts: triple(counts(999)) })).toThrow(/No legal/);
  const results = generateEventFormations({ ...base, troopCounts: triple(counts(1000)) });
  expect(results.every(validFormation)).toBe(true);
  expect(results[0].constraints.adaShieldMinimum).toBe(1000);
  expect(() => generateEventFormations({ ...base, troopCounts: triple(counts(1000)), adaShieldMinimum: 1001 })).toThrow(/No legal/);
  expect(generateEventFormations({ ...base, troopCounts: triple(counts(999)), adaShieldMinimum: null })).toHaveLength(5);
  const actual = structuredClone(results[0]);
  const adaTeam = actual.teams.find(t => positions.some(p => t.heroes[p].id === "Ada"))!;
  adaTeam.troopCounts = counts(999);
  expect(validFormation(actual)).toBe(false);
});

it("checks Ada only in her team with independent ratios and actual counts", () => {
  const results = generateEventFormations({ profile: profile(), event: eventData.events[0], catalog: classifiedFixture,
    ratios: { mode: "Independent", ratios: [{ shield: 0, bomber: 20, shooter: 80 }, ratio, { shield: 10, bomber: 20, shooter: 70 }] },
    troopCounts: [{ shield: 0, bomber: 20000, shooter: 80000 }, counts(), { shield: 10000, bomber: 20000, shooter: 70000 }],
  });
  expect(results).toHaveLength(5);
  for (const f of results) {
    expect(positions.some(p => f.teams[0].heroes[p].id === "Ada")).toBe(false);
    expect(validFormation(f)).toBe(true);
  }
});

it("rejects 0% starting ratios with Ada required, and rejects inconsistent or missing actual counts", () => {
  const event = eventData.events[0];
  const request = { profile: profile(), event, catalog: classifiedFixture, troopCounts: triple({ shield: 0, bomber: 20000, shooter: 80000 }) };
  expect(() => generateEventFormations(request)).toThrow(/0%/);
  expect(() => generateEventFormations({ ...request, troopCounts: triple(counts()), adaShieldMinimum: null })).toThrow(/matching/);
  expect(() => generateFormations({ mode: "Shared", ratio }, {}, classifiedFixture, { adaShieldMinimum: 1000 })).toThrow(/Actual troop/);
  expect(generateEventFormations({ ...request, troopCounts: undefined, adaShieldMinimum: null })[0].constraints.troopCountSource).toBe("not-provided");
  for (const invalid of [{ shield: -1, bomber: 9, shooter: 90 }, { shield: 1.5, bomber: 9, shooter: 90 }, { shield: 0, bomber: 0, shooter: 0 }, { shield: NaN, bomber: 9, shooter: 90 }]) expect(validTroopCounts(invalid, ratio)).toBe(false);
});

it("rejects repeated classes even with unique hero IDs and unknown classes without guessing", () => {
  const valid = generateFormations({ mode: "Shared", ratio }, {}, classifiedFixture)[0];
  const broken = structuredClone(valid);
  broken.teams[0].heroes.Middle.class = structuredClone(broken.teams[0].heroes.Left.class);
  expect(validFormation(broken)).toBe(false);
  expect(() => generateFormations({ mode: "Shared", ratio }, {}, heroCatalog)).toThrow(/Unknown classes/);
  const insufficient = classifiedFixture.map(h => ({ ...h, class: { value: "Shooter" as const, source: "https://example.invalid/synthetic" } }));
  expect(() => generateFormations({ mode: "Shared", ratio }, {}, insufficient)).toThrow(/Shieldbearer/);
});

it("keeps class independent of position and accepts unknown extra heroes only by excluding them", () => {
  const extra = { ...heroCatalog[0], id: "unknown-extra" };
  const results = generateFormations({ mode: "Shared", ratio }, { heroPositionPoints: { Ada: { Right: 99 } } }, [...classifiedFixture, extra]);
  expect(results.every(f => f.teams.some(t => t.heroes.Right.id === "Ada"))).toBe(true);
  expect(results.every(validFormation)).toBe(true);
});

it("keeps player-entered class overrides local, unverified and compatible with old saves", () => {
  const p = profile();
  const old = structuredClone(p); delete old.classOverrides;
  expect(migrateProfiles(JSON.stringify({ version: 2, profiles: [old] })).profiles).toHaveLength(1);
  p.classOverrides = Object.fromEntries(classifiedFixture.map(h => [h.id, { value: h.class!.value, verification: "unverified" as const }]));
  expect(eligibleHeroes(p).map(h => h.class!.value)).toEqual(classifiedFixture.map(h => h.class!.value));
  expect(heroCatalog.every(h => h.id === "Iwado" ? h.class?.value === "Shieldbearer" : ["Lunarl", "Flameborne"].includes(h.id) ? h.class?.value === "Bomber" : h.class === null)).toBe(true);
  let saved: string | null = null;
  const storage = { getItem: () => saved, setItem: (_: string, value: string) => { saved = value; } };
  saveProfile(storage, p);
  expect(loadProfiles(storage).profiles[0].classOverrides).toEqual(p.classOverrides);
});

it("validates seven-event data updates and rejects guessed damage conversions", async () => {
  const data = structuredClone(eventData);
  data.events[0].bonuses[0].damageMultiplier = 11 as any;
  expect(() => parseEvents(data)).toThrow(/multiplier/);
  expect(() => parseEvents({ ...eventData, events: eventData.events.slice(1) })).toThrow(/seven/);
  const duplicate = structuredClone(eventData); duplicate.events[1].day = "Monday";
  expect(() => parseEvents(duplicate)).toThrow(/duplicate/);
  const sunday = structuredClone(eventData); sunday.events[6].bonuses[0].reportedBoostPercent = 1000;
  expect(() => parseEvents(sunday)).toThrow(/bonus/);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => eventData }));
  expect(await fetchEvents()).toEqual(eventData);
});


it("generates all seven events from percentages alone without assuming Ada's pending condition", () => {
  for (const event of eventData.events) for (const mode of ["Shared", "Independent"] as const) {
    const result = generateEventFormations({ profile: profile(), event, catalog: classifiedFixture, ratios: startingRatios(event, mode) });
    expect(result).toHaveLength(5);
    for (const f of result) {
      expect(validFormation(f)).toBe(true);
      expect(f.teams.every(t => !t.troopCounts && t.ratio.shield + t.ratio.bomber + t.ratio.shooter === 100)).toBe(true);
      expect(f.constraints.troopCountSource).toBe("not-provided");
      expect(f.constraints.adaShieldMinimum).toBeNull();
      expect(f.warnings.join(" ")).toMatch(/not checked or assumed satisfied/);
    }
  }
});

it("keeps all seven exact display names separate from stable event IDs and bonus categories", async () => {
  const { eventDisplayName } = await import("./data/events");
  const ids = ["space", "wise", "cyber", "primal", "armed", "treasure", "warlord"];
  const names = ["Space Gorilla", "Wise Gorilla", "Cyber Gorilla", "Primal Gorilla", "Armed Gorilla", "Treasure Gorilla", "Gorilla Warlord"];
  expect(eventData.events.map(e => e.id)).toEqual(ids);
  expect(eventData.events.map(e => e.name)).toEqual(names);
  expect(ids.map(eventDisplayName)).toEqual(names);
  expect(eventDisplayName("not-an-event")).toBe("Unknown Gorilla");
  expect(eventData.events.slice(0, 6).map(e => e.bonuses[0].category)).toEqual(["satellite", "technology", "power-armor", "tome", "hero-equipment", "collection"]);
});
