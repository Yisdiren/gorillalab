import evidence from "../../public/hero-evidence.json";
import rankings from "../../public/community-rankings.json";
import { heroClasses, heroCatalog, parseCatalog, type Hero } from "./catalog";
import { positions, type ScoringRules } from "../engine";

export function heroEvidence(id: string) { return evidence.heroes.find(h => h.heroId === id) ?? null; }
/** Preserve explicit catalog values and player progression. Source checks are not in-game verification. */
export function catalogWithEvidence(catalog: readonly Hero[]): Hero[] {
  return parseCatalog({ version: 1, heroes: catalog.map(hero => {
    const e = heroEvidence(hero.id);
    if (!e) return structuredClone(hero);
    if (!heroClasses.includes(e.class as typeof heroClasses[number]) || !Number.isSafeInteger(e.seasonFrom) || e.seasonFrom < 0) throw new Error("Invalid hero evidence.");
    return { ...hero,
      class: hero.class ?? { value: e.class, source: e.source },
      seasonAvailability: hero.seasonAvailability ?? { from: e.seasonFrom, verification: "source-observed", source: e.source },
      skillMetadata: hero.skillMetadata.status !== "unknown" || !e.skills.length ? hero.skillMetadata : {
        status: "source-observed", skills: e.skills.map(s => ({ id: s.id, name: s.name, description: `${s.description} Trigger: ${s.trigger} Gorilla applicability unknown; numeric values not imported.`, source: s.source })),
      },
    };
  }) }).heroes;
}
export type Tier = "S" | "A" | "B" | "C" | "D";
validateGuideRankings(rankings.rankings, heroCatalog);
export const communityReference = rankings;
export function communityTier(id: string): Tier | null { return rankings.rankings.find(r => r.heroId === id)?.tier as Tier ?? null; }
export function communityScoringRules(base: ScoringRules = {}, weights: Record<Tier, number> = rankings.ordinalPoints): ScoringRules {
  if (!Object.values(weights).every(Number.isFinite)) throw new Error("Tier weights must be finite.");
  const heroPositionPoints = structuredClone(base.heroPositionPoints ?? {});
  for (const entry of rankings.rankings) {
    const tier = entry.tier as Tier;
    heroPositionPoints[entry.heroId] ??= {};
    for (const position of positions) heroPositionPoints[entry.heroId][position] = (heroPositionPoints[entry.heroId][position] ?? 0) + weights[tier];
  }
  return { ...base, heroPositionPoints };
}
export function communityExplanation(ids: string[]) {
  return ids.map(id => {
    const tier = communityTier(id);
    return { heroId: id, tier, points: tier === null ? 0 : communityReference.ordinalPoints[tier], explanation: tier === null ? "Not ranked / ambiguous reference name; no inferred weakness." : `Provisional community ${tier} tier; application ordinal points, not a combat value.`, source: communityReference.source };
  });
}

/** Fail closed if a data-only tier update contains an unknown identity or tier. */
export function validateGuideRankings(entries: readonly { heroId: string; tier: string }[], catalog: readonly Hero[]) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!catalog.some(h => h.id === entry.heroId) || !["S", "A", "B", "C", "D"].includes(entry.tier) || ids.has(entry.heroId)) throw new Error("Invalid, unmatched or duplicate guide tier identity.");
    ids.add(entry.heroId);
  }
  return entries;
}
