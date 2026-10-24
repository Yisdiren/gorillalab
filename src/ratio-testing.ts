import { canonical, validBattle, type Battle } from "./battles";
import { eventData, type GorillaEvent } from "./data/events";
import { positions, validRatio, type RatioMode, type Triple, type TroopRatio } from "./engine";
import type { PlayerProfile, Storage } from "./profiles";
import { robotsEnabledForEvent } from "./robots";
import type { ResultSnapshot } from "./ui/FormationResults";

export const RATIO_TEST_KEY = "gorillalab.ratio-tests.v1";
export type RatioCandidate = { id: string; profileId: string; server: number; eventId: string; name: string; ratios: RatioMode };
export function validRatios(value: unknown): value is RatioMode {
  const r = value as RatioMode | null;
  return !!r && (r.mode === "Shared" ? validRatio(r.ratio) : r.mode === "Independent" && Array.isArray(r.ratios) && r.ratios.length === 3 && r.ratios.every(validRatio));
}
export function ratioTeams(r: RatioMode): Triple<TroopRatio> { return (r.mode === "Shared" ? [r.ratio,r.ratio,r.ratio] : r.ratios).map(team => ({...team})) as Triple<TroopRatio>; }
export function ratioText(r: RatioMode) { return ratioTeams(r).map((t,i) => `T${i+1}: ${t.shield}% / ${t.bomber}% / ${t.shooter}%`).join(" · "); }
export function loadRatioCandidates(storage: Storage): RatioCandidate[] {
  const raw = storage.getItem(RATIO_TEST_KEY); if (raw === null) return [];
  const d = JSON.parse(raw);
  if (d.version !== 1 || !Array.isArray(d.candidates) || d.candidates.length > 1000 || !d.candidates.every((c: RatioCandidate) => c && typeof c.id === "string" && c.id && typeof c.profileId === "string" && c.profileId && Number.isSafeInteger(c.server) && c.server >= 0 && eventData.events.some(e=>e.id===c.eventId) && typeof c.name === "string" && c.name.trim() && c.name.length<=100 && validRatios(c.ratios)) || new Set(d.candidates.map((c: RatioCandidate)=>c.id)).size!==d.candidates.length) throw new Error("Invalid saved ratio candidates; no saved data changed.");
  return structuredClone(d.candidates);
}
export function saveRatioCandidate(storage: Storage, candidate: RatioCandidate) {
  const candidates = loadRatioCandidates(storage);
  if (candidates.some(c=>c.id===candidate.id)) throw new Error("Candidate already exists; no overwrite performed.");
  const next = {version:1,candidates:[...candidates,structuredClone(candidate)]};
  loadRatioCandidates({getItem:()=>JSON.stringify(next),setItem:()=>{}});
  storage.setItem(RATIO_TEST_KEY,JSON.stringify(next)); return next.candidates;
}
export function suggestRatios(event: GorillaEvent, current: RatioMode, records: readonly Battle[], profile: PlayerProfile): { name: string; ratios: RatioMode }[] {
  if (!validRatios(current)) throw new Error("Each team must total exactly 100% with values from 0 to 100.");
  const result: {name:string;ratios:RatioMode}[] = [], seen = new Set<string>();
  const add = (name:string, ratios:RatioMode) => { const key=canonical(ratioTeams(ratios));if(validRatios(ratios)&&!seen.has(key)&&result.length<8){seen.add(key);result.push({name,ratios:structuredClone(ratios)});} };
  const base = {mode:"Shared" as const,ratio:event.startingRatio};
  add("Guide baseline — reference",current.mode==="Shared"?base:{mode:"Independent",ratios:ratioTeams(base)});
  add("Current setup",current);
  for(const b of [...records].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) if(b.profileId===profile.id&&b.server===profile.serverNumber&&b.eventId===event.id&&b.ratios&&b.ratios.mode!=="unknown") {add("Previously recorded — metadata may be incomplete",b.ratios);break;}
  const shieldTuple=ratioTeams(current); if(shieldTuple[0].shooter>=1&&shieldTuple[0].shield<=99){shieldTuple[0]={...shieldTuple[0],shield:shieldTuple[0].shield+1,shooter:shieldTuple[0].shooter-1};add("Shieldbearer allocation experiment",current.mode==="Shared"?{mode:"Shared",ratio:shieldTuple[0]}:{mode:"Independent",ratios:shieldTuple});}
  for(const delta of [-5,5,-1,1]) {
    if(current.mode==="Shared") {const bomber=event.startingRatio.bomber+delta;if(bomber>=0&&bomber<=100)add("Nearby variation",{mode:"Shared",ratio:{shield:0,bomber,shooter:100-bomber}});}
    else for(let team=0;team<3;team++){const tuple=ratioTeams(current),bomber=tuple[team].bomber+delta;if(bomber>=0&&bomber+tuple[team].shield<=100){tuple[team]={...tuple[team],bomber,shooter:100-(tuple[team].shield+bomber)};add(`Team ${team+1} variation`,{mode:"Independent",ratios:tuple});}}
  }
  return result;
}
function relevantSetup(b:Battle) {
  const p=b.progressionSnapshot!;
  const ids=b.formation!.flatMap(t=>positions.map(pos=>t[pos]));
  const robots=robotsEnabledForEvent(b.eventId)?b.robotIds!:[];
  return { season:p.currentSeason, heroes:ids.map(id=>p.ownedHeroes.find(h=>h.heroId===id)).sort((a,b)=>a!.heroId<b!.heroId?-1:1), robots:robots.map(id=>id===null?null:p.ownedRobots.find(r=>r.robotId===id)) };
}
export function ratioEvidenceProblems(b:Battle):string[] {
  const reasons:string[]=[];
  if(!validBattle(b))return ["Invalid battle record."];
  if(!b.profileId)reasons.push("Profile identity is unknown.");
  if(!b.date&&!b.observedAt)reasons.push("Battle date/time is unknown.");
  if(b.attackKind==="unknown")reasons.push("Damage measurement type is unknown.");
  if(!b.ratios||b.ratios.mode==="unknown")reasons.push("Ratio mode or all-team ratios are unknown.");
  if(!b.formation)reasons.push("Hero assignments are unknown.");
  if(!b.progressionSnapshot||b.progressionSnapshot.currentSeason===null)reasons.push("Progression snapshot or season is unknown.");
  if(!b.testConditions?.confirmed||!b.testConditions.group.trim()||!b.testConditions.setup.trim())reasons.push("Comparable test conditions have not been explicitly recorded and confirmed.");
  if(b.formation&&b.progressionSnapshot)for(const id of b.formation.flatMap(t=>positions.map(pos=>t[pos])))if(b.progressionSnapshot.ownedHeroes.find(h=>h.heroId===id)?.stars==null)reasons.push(`${id}: star progression is unknown.`);
  if(robotsEnabledForEvent(b.eventId)) {
    if(!b.robotIds)reasons.push("Robot assignments are unknown.");
    else for(const id of b.robotIds)if(id!==null&&b.progressionSnapshot?.ownedRobots.find(r=>r.robotId===id)?.level==null)reasons.push(`${id}: robot progression is unknown.`);
  }
  return reasons;
}
export function compareRatioBattles(a:Battle,b:Battle,allowSameRecord=false) {
  const blocked=[...ratioEvidenceProblems(a).map(r=>`First: ${r}`),...ratioEvidenceProblems(b).map(r=>`Second: ${r}`)];
  if(a.id===b.id&&!allowSameRecord)blocked.push("Select two distinct battle records; one record is not a repeated sample.");
  if(a.profileId!==b.profileId)blocked.push("Different player profiles.");
  if(a.server!==b.server)blocked.push("Different servers.");
  if(a.eventId!==b.eventId)blocked.push("Different Gorilla events.");
  if(a.attackKind!==b.attackKind||a.attackCount!==b.attackCount)blocked.push("Different attack measurement types; totals and individual hits are never pooled.");
  const changes:string[]=[];
  if(a.formation&&b.formation&&canonical(a.formation)!==canonical(b.formation))changes.push("Hero assignments changed.");
  if(robotsEnabledForEvent(a.eventId)&&canonical(a.robotIds)!==canonical(b.robotIds))changes.push("Robot assignments changed.");
  if(a.progressionSnapshot&&b.progressionSnapshot&&a.formation&&b.formation&&canonical(relevantSetup(a))!==canonical(relevantSetup(b)))changes.push("Relevant hero, season or robot progression changed.");
  if(canonical(a.testConditions)!==canonical(b.testConditions))changes.push("Recorded test conditions changed.");
  blocked.push(...changes);
  return {comparable:blocked.length===0,blocked,changes,damageDifference:blocked.length?null:b.damage-a.damage,percentDifference:blocked.length||a.damage===0?null:(b.damage-a.damage)/a.damage*100,
    limitations:["Observed damage only, not a prediction or a causal proof. Randomness and unrecorded conditions remain.","Conditions are player-confirmed, not independently verified. No troop counts are required; count-dependent triggers remain unverified.",...(!a.observedAt||!b.observedAt?["At least one record has no time of day; date-only evidence is less precise."]:[]),...(a.damage===0?["Percentage difference is undefined when the first damage is zero."]:[])]};
}
export function bestObservedRatios(records:readonly Battle[],anchor:Battle) {
  const seenIds=new Set<string>();
  const eligible=records.filter(b=>{if(seenIds.has(b.id))return false;seenIds.add(b.id);return compareRatioBattles(anchor,b,true).comparable;});
  const groups=new Map<string,{ratios:RatioMode;maxDamage:number;samples:number}>();
  for(const b of eligible){const ratios=b.ratios as RatioMode,key=canonical(ratioTeams(ratios)),old=groups.get(key);groups.set(key,{ratios:structuredClone(ratios),maxDamage:Math.max(old?.maxDamage??0,b.damage),samples:(old?.samples??0)+1});}
  return {samples:eligible.length,groups:[...groups.values()].sort((a,b)=>b.maxDamage-a.maxDamage||(canonical(a.ratios)<canonical(b.ratios)?-1:canonical(a.ratios)>canonical(b.ratios)?1:0)),limitations:"Best Observed is the highest recorded comparable result, not Optimal. A single sample cannot establish the best ratio; unequal samples and variance can favor a maximum."};
}
export function applyRatioToSnapshot(snapshot:ResultSnapshot,index:number,ratios:RatioMode):ResultSnapshot {
  if(!validRatios(ratios)||!snapshot.formations[index])throw new Error("Select a formation and valid 100% ratios.");
  const next=structuredClone(snapshot),formation=next.formations[index];
  if(formation.breakdown.teams.some(t=>Object.values(t.troopPoints).some(n=>n!==0)))throw new Error("Custom ratio scoring requires rescoring; this action cannot preserve that score.");
  ratioTeams(ratios).forEach((ratio,i)=>{formation.teams[i].ratio=ratio;delete formation.teams[i].troopCounts;});
  formation.warnings.push("Experimental percentage change; actual counts and count-dependent triggers remain unknown. No damage prediction is made.");
  formation.constraints={...formation.constraints,troopCountSource:"not-provided",adaShieldMinimum:null};
  next.ratioModes??=next.formations.map(f=>({mode:"Independent",ratios:f.teams.map(t=>t.ratio) as Triple<TroopRatio>}));
  next.ratioModes[index]=structuredClone(ratios);
  return next;
}
