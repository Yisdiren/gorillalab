import { expect, it } from "vitest";
import { applyRatioToSnapshot, bestObservedRatios, compareRatioBattles, loadRatioCandidates, ratioEvidenceProblems, ratioTeams, RATIO_TEST_KEY, saveRatioCandidate, suggestRatios, validRatios } from "./ratio-testing";
import { BATTLE_KEY, emptyBattle, exportBattleCSV, exportBattleJSON, parseBattleCSV, parseBattles, saveBattle, validBattle, type Battle } from "./battles";
import { systemProfile, systemStorage } from "./test/system-fixtures";
import { eventData } from "./data/events";
import { generateEventFormations } from "./event-engine";
import { classifiedFixture } from "./test/fixtures";
import { positions, type RatioMode } from "./engine";
import { saveProfile, STORAGE_KEY } from "./profiles";
function fixture(id="one",damage=100):Battle {
  const p=systemProfile(),event=eventData.events[0];
  const formation=generateEventFormations({profile:p,event,catalog:classifiedFixture})[0];
  return {...emptyBattle(id,p.serverNumber!,event.id),profileId:p.id,playerName:p.name,date:"2026-10-24",observedAt:"2026-10-24T12:30:00-04:00",damage,attackKind:"individual",attackCount:1,formation:formation.teams.map(t=>Object.fromEntries(positions.map(pos=>[pos,t.heroes[pos].id]))) as Battle["formation"],ratios:{mode:"Shared",ratio:{shield:0,bomber:20,shooter:80}},robotIds:null,progressionSnapshot:p,testConditions:{group:"Round A",setup:'Same boss, tier and upgrades; checked "skills"\nEquipment unchanged',confirmed:true}};
}
it("validates shared and independent finite percentages and exact totals without counts",()=>{
  expect(validRatios({mode:"Shared",ratio:{shield:0,bomber:4,shooter:96}})).toBe(true);
  expect(validRatios({mode:"Independent",ratios:[{shield:0,bomber:20,shooter:80},{shield:1,bomber:9,shooter:90},{shield:0,bomber:4,shooter:96}]})).toBe(true);
  for(const ratio of [{shield:0,bomber:20,shooter:81},{shield:-1,bomber:21,shooter:80},{shield:NaN,bomber:20,shooter:80},{shield:0,bomber:Infinity,shooter:0}])expect(validRatios({mode:"Shared",ratio})).toBe(false);
  expect(validRatios({mode:"Independent",ratios:[]})).toBe(false);
});
for(const event of eventData.events)for(const mode of ["Shared","Independent"] as const)it(`suggests bounded diverse ${mode} tests for ${event.id}`,()=>{
  const p=systemProfile(),ratio=event.startingRatio;
  const current:RatioMode=mode==="Shared"?{mode,ratio}:{mode,ratios:[ratio,ratio,ratio]};
  const record=fixture();record.eventId=event.id;record.ratios={mode:"Shared",ratio:{shield:0,bomber:4,shooter:96}};
  const list=suggestRatios(event,current,[record],p);
  expect(list).toEqual(suggestRatios(event,current,[record],p));expect(list.length).toBeLessThanOrEqual(8);expect(list.length).toBeGreaterThan(2);
  expect(ratioTeams(list[0].ratios)).toEqual([ratio,ratio,ratio]);expect(list.some(c=>c.name.startsWith("Previously"))).toBe(true);
  expect(list.every(c=>validRatios(c.ratios))).toBe(true);
  expect(new Set(list.map(c=>JSON.stringify(ratioTeams(c.ratios)))).size).toBe(list.length);
});
it("isolates candidate storage by profile, server and event and refuses corrupt overwrites",()=>{
  const storage=systemStorage(),p=systemProfile();saveProfile(storage,p);saveBattle(storage,fixture());
  const profiles=storage.getItem(STORAGE_KEY),history=storage.getItem(BATTLE_KEY);
  const candidate={id:"a",profileId:p.id,server:p.serverNumber!,eventId:"space",name:"Test",ratios:fixture().ratios as RatioMode};
  saveRatioCandidate(storage,candidate);saveRatioCandidate(storage,{...candidate,id:"b",profileId:"another",server:248,eventId:"wise"});
  expect(loadRatioCandidates(storage)).toHaveLength(2);expect(()=>saveRatioCandidate(storage,candidate)).toThrow(/overwrite/);
  expect(storage.getItem(STORAGE_KEY)).toBe(profiles);expect(storage.getItem(BATTLE_KEY)).toBe(history);
  storage.setItem(RATIO_TEST_KEY,'{"version":99}');expect(()=>saveRatioCandidate(storage,{...candidate,id:"c"})).toThrow();expect(storage.getItem(RATIO_TEST_KEY)).toBe('{"version":99}');
});
it("compares percentage-only tests and handles zero damage without division by zero",()=>{
  const a=fixture(),b=fixture("two",125);b.ratios={mode:"Shared",ratio:{shield:0,bomber:4,shooter:96}};
  expect(compareRatioBattles(a,b)).toMatchObject({comparable:true,damageDifference:25,percentDifference:25});
  a.damage=0;expect(compareRatioBattles(a,b)).toMatchObject({comparable:true,damageDifference:125,percentDifference:null});
});
it.each(["profile","server","event","aggregation","heroes","stars","conditions","missing","season"])("blocks noncomparable %s evidence",kind=>{
  const a=fixture(),b=fixture("two",200);
  if(kind==="profile")b.profileId="other";if(kind==="server")b.server=248;if(kind==="event")b.eventId="wise";
  if(kind==="aggregation"){b.attackKind="five-attack-total";b.attackCount=5;}
  if(kind==="heroes"){const t=b.formation![0];[t.Left,t.Middle]=[t.Middle,t.Left];}
  if(kind==="stars")b.progressionSnapshot!.ownedHeroes[0].stars=4;
  if(kind==="conditions")b.testConditions!.setup="Changed upgrades";
  if(kind==="missing")delete b.testConditions;if(kind==="season")b.progressionSnapshot!.currentSeason=null;
  expect(compareRatioBattles(a,b).comparable).toBe(false);expect(compareRatioBattles(a,b).damageDifference).toBeNull();
});
it("does not pool individual hits with totals and never divides five-hit totals",()=>{
  const a=fixture(),b=fixture("two",500);a.attackKind=b.attackKind="five-attack-total";a.attackCount=b.attackCount=5;
  expect(compareRatioBattles(a,b)).toMatchObject({comparable:true,damageDifference:400});
  expect(bestObservedRatios([a,b],a).groups[0].maxDamage).toBe(500);
});
it("ignores robots in the five non-robot events but detects Cyber robot progression changes",()=>{
  const a=fixture(),b=fixture("two",200);b.progressionSnapshot!.ownedRobots=[{robotId:"Unrelated",level:99,upgrades:{x:4}}];b.robotIds=["Unrelated",null,null];
  expect(compareRatioBattles(a,b).comparable).toBe(true);
  a.eventId=b.eventId="cyber";a.progressionSnapshot!.ownedRobots=[{robotId:"Unrelated",level:1,upgrades:{}}];a.robotIds=["Unrelated",null,null];
  expect(compareRatioBattles(a,b).comparable).toBe(false);
});
it("reports Best Observed sample counts within a compatible group only",()=>{
  const a=fixture(),b=fixture("two",130),c=fixture("three",90),foreign=fixture("foreign",100000);
  b.ratios={mode:"Shared",ratio:{shield:0,bomber:4,shooter:96}};c.ratios=structuredClone(b.ratios);foreign.server=260;
  const result=bestObservedRatios([a,b,c,foreign],a);
  expect(result.samples).toBe(3);expect(result.groups[0]).toMatchObject({maxDamage:130,samples:2});
  expect(bestObservedRatios([a],a).limitations).toContain("single sample");
  expect(ratioEvidenceProblems({...a,ratios:{mode:"unknown",ratio:{shield:0,bomber:4,shooter:96}}}).join()).toContain("mode");
});
it("preserves new metadata through JSON/CSV and accepts legacy CSV without optional columns",()=>{
  const old=emptyBattle("legacy",10004,"space"),modern=fixture();
  expect(parseBattles(exportBattleJSON([old,modern],10004))).toEqual([old,modern]);
  expect(parseBattleCSV(exportBattleCSV([old,modern],10004))).toEqual([old,modern]);
  const lines=exportBattleCSV([old],10004).split("\r\n");const legacy=[lines[0].split(",").slice(0,-2).join(","),lines[1].replace(/,"null","null"$/,"")].join("\r\n");
  expect(parseBattleCSV(legacy)).toEqual([old]);
  expect(validBattle({...modern,observedAt:"2026-02-30T12:30:00Z"})).toBe(false);
});
it("applies ratios only to the selected formation while preserving heroes, profiles and score",()=>{
  const profile=systemProfile(),formations=generateEventFormations({profile,event:eventData.events[0],catalog:classifiedFixture}),snapshot={profile,formations};const before=structuredClone(snapshot);
  const next=applyRatioToSnapshot(snapshot,3,{mode:"Shared",ratio:{shield:0,bomber:4,shooter:96}});
  expect(next.formations[3].teams.map(t=>t.heroes)).toEqual(before.formations[3].teams.map(t=>t.heroes));expect(next.formations[0]).toEqual(before.formations[0]);
  expect(next.formations[3].score).toBe(before.formations[3].score);expect(next.profile).toEqual(before.profile);expect(snapshot).toEqual(before);
  expect(next.formations[3].teams.every(t=>t.ratio.bomber===4)).toBe(true);expect(next.ratioModes?.[3].mode).toBe("Shared");
});

it("creates independent team objects when expanding a shared ratio",()=>{
 const shared={mode:"Shared" as const,ratio:{shield:0,bomber:20,shooter:80}};
 const teams=ratioTeams(shared);teams[1].bomber=9;teams[1].shooter=91;
 expect(teams[0]).toEqual({shield:0,bomber:20,shooter:80});expect(teams[2]).toEqual(teams[0]);expect(shared.ratio.bomber).toBe(20);
});

it("does not treat the same battle as two measurements or inflate Best Observed samples",()=>{
 const a=fixture();expect(compareRatioBattles(a,a).comparable).toBe(false);
 expect(bestObservedRatios([a,a],a).samples).toBe(1);
});
