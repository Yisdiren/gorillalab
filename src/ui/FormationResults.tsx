import { eventDisplayName } from "../data/events";
import { assessRanking } from "../ranking";
import { robotsEnabledForEvent } from "../robots";
import { useState } from "react";
import { positions, type RatioMode } from "../engine";
import { HeroPortrait } from "./HeroPortrait";
import type { EventFormation } from "../event-engine";
import type { PlayerProfile } from "../profiles";

export type ResultSnapshot = { formations: EventFormation[]; profile: PlayerProfile; ratioModes?: RatioMode[] };
const number = (n: number) => n.toLocaleString("en-US");
export function FormationResults({ snapshot, onLog }: { snapshot: ResultSnapshot | null; onLog?: (formationIndex: number) => void }) {
  const [display, setDisplay] = useState({ snapshot, expanded: false });
  if (display.snapshot !== snapshot) setDisplay({ snapshot, expanded: false });
  const ranking = assessRanking(snapshot?.formations ?? []);
  const renderFormation = (formation: EventFormation, rank: number) => {
    if (!snapshot) return null;
    return <article className="formation" key={formation.id} aria-label={`Formation ${rank + 1}`}>
        <header className="formation-header"><div className="formation-name"><span className="rank">{String(rank + 1).padStart(2, "0")}</span><div><h3>{rank === 0 ? (ranking.meaningful ? "Recommended Formation" : "Unranked Formation") : `Alternative Formation ${rank + 1}`}</h3><p>{eventDisplayName(formation.event.id)} · {snapshot.profile.name}</p></div></div><div className="score" title="Ordinal heuristic preference points, never predicted damage"><strong>{number(formation.score)}</strong><span>heuristic points</span></div></header>
        <div className="team-grid">{formation.teams.map((team, index) => {
          const robotId = snapshot.profile.teamRobotIds?.[index];
          return <section className="team-card" key={index} aria-label={`Formation ${rank + 1} team ${index + 1}`}>
            <div className="team-header"><h4>Team {index + 1} <span className="in-game-lane">— {["TOP", "MIDDLE", "BOTTOM"][index]} IN GAME</span></h4><span>100% total</span></div>
            <div className="team-hero-slots">{positions.map(position => {
              const hero = team.heroes[position];
              const owned = snapshot.profile.ownedHeroes.find(h => h.heroId === hero.id);
              return <div className="hero-position" key={position}><span className="position-name">{position}</span><div className="formation-hero-identity"><HeroPortrait hero={hero} size="formation" /><div><strong>{hero.name}</strong><span className="stars">{owned?.stars == null ? "Stars unknown" : `${owned.stars} ★`}</span><span className={`hero-class ${hero.class?.value.toLowerCase() ?? ""}`}>{hero.class?.value ?? "Class unknown"}</span></div></div></div>;
            })}</div>
            <div className="team-ratios" aria-label="Troop percentages"><span className="ratio-shield">Shieldbearer <b>{team.ratio.shield}%</b></span><span className="ratio-bomber">Bomber <b>{team.ratio.bomber}%</b></span><span className="ratio-shooter">Shooter <b>{team.ratio.shooter}%</b></span></div>
            {robotsEnabledForEvent(formation.event.id) && <div className="robot-assignment"><span aria-hidden="true">◇</span> Robot: {robotId ?? "None"}</div>}
          </section>;
        })}</div>
        {rank === 0 && <div className="notice ranking-confidence"><strong>{ranking.meaningful ? "Why this candidate ranks first" : "Ranking confidence limited"}</strong><p>{ranking.reason}</p>{!!formation.guideCoverage?.unknownHeroIds.length && <p>Unknown tier candidates: {formation.guideCoverage.unknownHeroIds.join(", ")}. Their absence from the leading candidates is not proof of weakness.</p>}<p>Guide rankings use one general list for all seven events. No event-specific tier, hero-position advantage or percentage damage effect is inferred.</p></div>}
        {onLog && <button className="secondary" onClick={() => onLog(rank)}>Log an attack with this setup</button>}<details className="explanation"><summary>Score explanation & data warnings</summary>{formation.score === 0 && <p>0 heuristic points means the configured scoring inputs contributed no points. It does not mean zero damage or weak heroes. Robot availability does not explain or change this score.</p>}<p>Each score adds configured hero-position points and troop-ratio points. {formation.communityRanking ? "Community-tier ordinal preferences are enabled; those points are not combat effects." : "Guide rankings are disabled; unspecified custom weights are zero. Ties have no evidence-based preference."} Event +1000% labels have no assumed damage multiplier.</p>{formation.communityRanking && <div><h4>Provisional community ranking points</h4><p><a href="https://lojxlab.com/gorilla-legion/" target="_blank" rel="noreferrer">Source: WaysToDie & pikaboo guide, reproduced by LOJXLab</a>. Application ordinal scale S=4, A=3, B=2, C=1, D=0. Unknown contributes no inferred points, not an inferred D tier. These spacing choices are application preferences, not measured combat differences.</p><ul>{formation.communityRanking.map(entry => <li key={entry.heroId}>{entry.heroId}: {entry.tier ?? "Unknown"}, {entry.points} ordinal points. {entry.explanation}</li>)}</ul><p>These preferences are separate from verified combat effects; no skill, equipment, robot or daily boost multiplier is inferred.</p></div>}<div className="breakdown-grid">{formation.breakdown.teams.map((team, i) => <div key={i}><strong>Team {i + 1}: {team.total} points</strong><p>Hero positions: {Object.values(team.positionPoints).reduce((a, b) => a + b, 0)}<br />Troop ratios: {Object.values(team.troopPoints).reduce((a, b) => a + b, 0)}</p></div>)}</div><p>Exact additive class-assignment search evaluated {formation.search.eligibleCount} candidate heroes and safely retained {formation.search.consideredCount} slot candidates. These are the top five for the configured additive score and supplied ratios, not a proven combat or damage optimum. Teams with swapped positions or order are distinct.</p><p>Ada Shieldbearer check: {formation.constraints.adaShieldMinimum === null ? "not evaluated — actual counts unknown; no condition assumed satisfied" : `${formation.constraints.adaShieldMinimum.toLocaleString()} actual troops required in her team`} — pending verification. {robotsEnabledForEvent(formation.event.id) ? "Robot assignments are manual and have no assumed combat effect or reuse rule." : "Robots are not used in this event and cannot contribute scoring points."}</p><ul>{formation.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>
      </article>;
  };
  return <section className="results-section" id="formation-results" aria-labelledby="results-title">
    <div className="section-heading"><div><span className="eyebrow">YOUR ATTACK PLAN</span><h2 id="results-title">Formation results</h2></div><span className="badge">{snapshot ? `${snapshot.formations.length} found` : "Awaiting setup"}</span></div>
    {!snapshot ? <div className="empty-state"><div className="empty-symbol" aria-hidden="true">Ⅲ</div><h3>Your next attack starts here.</h3><p>Choose an event, set up your heroes and troops, then generate five formations.</p><span>3 teams · 9 unique heroes · one of each class per team</span></div> : <>
      <div className="notice warning"><strong>Unverified combat data</strong><p>These are heuristic points, not actual damage. Missing data does not mean a hero is weak. Portrait artwork may contain original game UI levels; the stars listed beside each hero are your entered profile values. Event bonuses, skills, progression, equipment, and robots are not converted into damage or bonus scores.</p></div>
      {snapshot.formations[0] && renderFormation(snapshot.formations[0], 0)}
      {snapshot.formations.length > 1 && <div className="alternative-formations"><button className="secondary alternatives-toggle" aria-expanded={display.expanded} aria-controls="alternative-formation-list" onClick={() => setDisplay({ snapshot, expanded: !display.expanded })}>{display.expanded ? "Hide" : "Show"} {snapshot.formations.length - 1} Alternative {snapshot.formations.length === 2 ? "Formation" : "Formations"}</button><div id="alternative-formation-list" hidden={!display.expanded}>{display.expanded && snapshot.formations.slice(1).map((formation, index) => renderFormation(formation, index + 1))}</div></div>}
    </>}
  </section>;
}




