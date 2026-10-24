import type { EventFormation } from "./event-engine";

/** A source tier does not distinguish team order, hero position or ratios. */
export function assessRanking(formations: readonly EventFormation[]) {
  const first = formations[0];
  if (!first) return { meaningful: false, reason: "No valid candidates available.", tied: 0, unknown: 0 };
  const selectedUnknown = first.communityRanking?.filter(entry => entry.tier === null).length ?? 0;
  const unknown = Math.max(selectedUnknown, first.guideCoverage?.unknownHeroIds.length ?? 0, ...formations.map(f => f.communityRanking?.filter(e => e.tier === null).length ?? 0));
  const tied = formations.filter(f => f.score === first.score).length;
  const differs = formations.some(f => f.score !== first.score);
  const guide = !!first.communityRanking;
  const reason = unknown > 0 ? `${selectedUnknown ? `${selectedUnknown} of nine selected heroes have` : `At least ${unknown} eligible candidate heroes have`} Unknown guide tiers. Partial ordinal points cannot establish a confident recommendation; Unknown does not mean weak.` :
    !differs ? `${formations.length === 1 ? "Only one candidate is available" : `All ${formations.length} returned candidates tie at ${first.score} heuristic points`}. The guide does not rank hero positions, team order or troop ratios. Display order is deterministic, not evidence of superiority.` :
    `${first.score} heuristic points is the highest score among the returned candidates under ${guide ? "the guide's provisional hero-tier preferences" : "explicit configured heuristic weights"}.${tied > 1 ? ` ${tied} candidates share first place; their order is deterministic and confidence is limited.` : ""} This is not a global optimum or a damage prediction.`;
  return { meaningful: differs && unknown === 0, reason, tied, unknown };
}
