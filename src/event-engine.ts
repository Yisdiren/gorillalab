import { heroCatalog, type Hero } from "./data/catalog";
import { eventData, type GorillaEvent } from "./data/events";
import { type Formation, type RatioMode, type ScoringRules, type Triple, type TroopCounts } from "./engine";
import { eligibleHeroes, eligibilityReport, generateForProfile, type PlayerProfile } from "./profiles";
import { catalogWithEvidence, communityExplanation, communityScoringRules, communityTier } from "./data/evidence";
import { positions } from "./engine";

export type EventFormation = Formation & {
  event: GorillaEvent;
  eventBonusScoring: "unknown-not-applied";
  eventSource: "guide-reported-not-independently-verified";
  eligibilityAudit?: { heroId: string; status: string; reason: string }[];
  guideCoverage?: { eligibleHeroes: number; unknownHeroIds: string[] };
  communityRanking?: ReturnType<typeof communityExplanation>;
};
export function startingRatios(event: GorillaEvent, mode: "Shared" | "Independent" = "Shared"): RatioMode {
  return mode === "Shared" ? { mode, ratio: { ...event.startingRatio } } :
    { mode, ratios: Array.from({ length: 3 }, () => ({ ...event.startingRatio })) as Triple<typeof event.startingRatio> };
}
export function generateEventFormations(request: {
  profile: PlayerProfile;
  event: GorillaEvent;
  troopCounts?: Triple<TroopCounts>;
  ratios?: RatioMode;
  rules?: ScoringRules;
  useCommunityRankings?: boolean;
  catalog?: readonly Hero[];
  /** Only evaluated when explicit counts are supplied; omission then uses configured default, null disables. */
  adaShieldMinimum?: number | null;
}): EventFormation[] {
  if (request.troopCounts !== undefined && (!Array.isArray(request.troopCounts) || request.troopCounts.length !== 3)) throw new Error("Actual troop counts are required for all three teams.");
  const minimum = request.adaShieldMinimum === undefined ? eventData.adaShieldRule.minimumShieldbearers : request.adaShieldMinimum;
  const useCommunityRankings = request.useCommunityRankings !== false;
  const rules = useCommunityRankings ? communityScoringRules(request.rules) : request.rules ?? {};
  const catalog = request.catalog ?? catalogWithEvidence(heroCatalog);
  const eligibilityAudit = eligibilityReport(request.profile, catalog).map(({ heroId, status, reason }) => ({ heroId, status, reason }));
  const eligible = eligibleHeroes(request.profile, catalog);
  const guideCoverage = { eligibleHeroes: eligible.length, unknownHeroIds: eligible.filter(h => communityTier(h.id) === null).map(h => h.id) };
  const formations = generateForProfile(request.profile, request.ratios ?? startingRatios(request.event), rules, catalog,
    { ...(request.troopCounts ? { troopCounts: request.troopCounts, ...(minimum === null ? {} : { adaShieldMinimum: minimum }) } : {}) });
  return formations.map(formation => ({ ...formation, eligibilityAudit, warnings: [...formation.warnings, ...eligibilityAudit.filter(row => row.status !== "eligible").map(row => row.heroId + ": " + row.reason), ...(!request.troopCounts ? ["Actual troop counts are unknown. Ada’s possible 1,000-Shieldbearer condition is unverified and not checked or assumed satisfied; no skill benefit is applied."] : [])], event: structuredClone(request.event), eventBonusScoring: "unknown-not-applied", eventSource: "guide-reported-not-independently-verified", ...(useCommunityRankings ? { guideCoverage, communityRanking: communityExplanation(formation.teams.flatMap(t => positions.map(p => t.heroes[p].id))) } : {}) }));
}
