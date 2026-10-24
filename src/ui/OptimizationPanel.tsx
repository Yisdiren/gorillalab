import { useState } from "react";
import { eventDisplayName, type GorillaEvent } from "../data/events";
import type { Hero } from "../data/catalog";
import { communityReference } from "../data/evidence";
import { canonical, loadBattles } from "../battles";
import { optimizeAttack, type OptimizationPlan } from "../optimization";
import type { RatioMode, Triple } from "../engine";
import type { PlayerProfile, Storage } from "../profiles";
import { robotsEnabledForEvent, type RobotReuse } from "../robots";

export function OptimizationPanel({ profile, event, catalog, ratios, minimum, community, storage, apply }: {
  profile: PlayerProfile | null; event: GorillaEvent; catalog: readonly Hero[]; ratios: RatioMode; totals?: Triple<number>;
  minimum?: number | null; community: boolean; storage: Storage; apply: (plan: OptimizationPlan) => void;
}) {
  const robotsEnabled = robotsEnabledForEvent(event.id);
  const [reuse, setReuse] = useState<RobotReuse>("unknown");
  const [evaluatedResult, setResult] = useState<ReturnType<typeof optimizeAttack> | null>(null);
  const [evaluatedContext, setEvaluatedContext] = useState("");
  const context = canonical({ profile, event, catalog, ratios, minimum, community });
  const result = evaluatedContext === context ? evaluatedResult : null;
  const [error, setError] = useState("");
  return <section className="panel lab-panel"><div className="panel-heading"><div><span className="eyebrow">BOUNDED TEST PLANNER</span><h2>{robotsEnabled ? "Ratio & robot optimization" : "Ratio optimization"}</h2></div></div>
    <p className="muted">Compare feasible Shared or Independent ratios around this Gorilla's guide baseline. Explicit heuristic points and guide proximity rank percentage-only plans. Missing actual counts prevent controlled count-matched damage ranking; no damage optimum is claimed. Every candidate team totals 100%. Actual counts are unknown; count-dependent effects are not assumed.</p>
    {robotsEnabled && <><div className="field-grid"><label>Robot reuse setting<select value={reuse} onChange={e => { setReuse(e.target.value as RobotReuse); setResult(null); }}><option value="unknown">Unknown — manual / single-robot tests</option><option value="unique">Player constraint: no reuse</option><option value="allowed">Player assumption: allow reuse</option></select></label></div>
    <p className="muted">None is always a robot option. Only owned robots are considered. Levels, cores, and upgrades are retained; undocumented effects add no bonuses. Reuse settings are player test constraints, not verified rules.</p></>}
    <button className="secondary" disabled={!profile} onClick={() => { try { setError(""); setEvaluatedContext(context); setResult(optimizeAttack({ profile: profile!, event, catalog, ratios, useCommunityRankings: community, robotReuse: reuse, records: loadBattles(storage) })); } catch (e) { setError(String(e)); setResult(null); } }}>{robotsEnabled ? "Compare candidate ratios & robots" : "Compare candidate ratios"}</button>
    {error && <p role="alert" className="notice error">{error}</p>}
    {result && <div className="optimization-results"><p>{result.examinedRatioConfigurations} ratio configurations · {robotsEnabled && <>{result.examinedRobotConfigurations} robot configurations · </>} {result.rejectedConfigurations} infeasible · deterministic bounded search</p>{result.plans.map((plan, i) => <article className="optimization-plan" key={i}><h3>Test plan {i + 1} · {plan.formation.score} heuristic points</h3><div className="plan-ratio-comparison" aria-label="Candidate and guide ratios"><div><span>Guide baseline · {eventDisplayName(event.id)}</span><strong>{event.startingRatio.shield}/{event.startingRatio.bomber}/{event.startingRatio.shooter}</strong><small>Starting recommendation, not a proven optimum</small></div><div><span>{plan.ratios.mode} candidate ratios</span><strong>{(plan.ratios.mode === "Shared" ? [plan.ratios.ratio] : plan.ratios.ratios).map(r => `${r.shield}% / ${r.bomber}% / ${r.shooter}%`).join(" · ")}</strong><small>Shieldbearer / Bomber / Shooter · planned test setup</small></div></div><p className="muted">Count-dependent skill conditions, including Ada’s possible 1,000-Shieldbearer requirement, remain unverified.</p>{robotsEnabled && <p>Robots: {plan.robots.map(id => id ?? "None").join(" / ")}. {plan.robotEffects.flatMap(t => t.applied).length} documented Gorilla effects applicable; these are reported separately, not multiplied into damage.</p>}<p>{plan.observedMeanDamage === null ? "Matching observed damage: unavailable." : `Observed mean damage: ${plan.observedMeanDamage.toLocaleString()} (${plan.observationCount} individual records). Not predicted damage.`}</p>{robotsEnabled && <details className="source-details"><summary>Robot effect evidence</summary>{plan.robotEffects.map(team => <div key={team.team}><strong>Team {team.team + 1}: {team.robotId ?? "None"}</strong><ul>{team.applied.map(effect => <li key={effect.id}>{effect.metric}: {effect.value}, exact documented progression. <a href={effect.source}>Source</a></li>)}{team.unresolved.map(text => <li key={text}>{text}</li>)}</ul></div>)}</details>}<p className="muted">{plan.explanation}</p><button className="secondary" onClick={() => apply(plan)}>Use planned setup — percentages</button></article>)}</div>}
    <details className="source-details"><summary>Community rankings & evidence limits</summary><p>Optional rankings are {communityReference.status}. S/A/B/C/D use configurable application ordinal points 4/3/2/1/0; unknown is not a weak tier. The same general ranking covers all seven events; event-specific tiers are unavailable.</p><a href={communityReference.source} target="_blank" rel="noreferrer">Gorilla Legion community reference ↗</a><ul>{communityReference.conflicts.map(conflict => <li key={conflict}>{conflict.includes("GorillaLab retains") ? "Historical sources disagree about rotation order. The current player-confirmed usual order is Cyber Wednesday, Primal Thursday; check your configured cycle and Current Boss." : conflict}</li>)}</ul><p>Lunari in the guide maps to canonical Lunarl by explicit player confirmation. Iwado has its own D tier; Iwakado remains Unknown and is not merged. No combat multipliers are inferred from +1000% daily labels.</p></details>
  </section>;
}


