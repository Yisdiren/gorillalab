import { expect,it } from "vitest";
import { defaultSettings,exampleCycle,loadScheduleSettings,needsOrderReview,resolveOrderReview,SCHEDULE_KEY,USUAL_EVENT_ORDER } from "./server-schedule";
import { systemStorage } from "./test/system-fixtures";
const oldOrder=["space","wise","cyber","primal","armed","treasure","warlord"];
function fixture(){const storage=systemStorage(),settings=defaultSettings("fixture",248);settings.recurrence.order=[...oldOrder];storage.setItem(SCHEDULE_KEY,JSON.stringify({version:3,entries:[settings]}));return {storage,settings};}
it("never infers default provenance from an exact legacy match or writes during reload",()=>{
  const {storage,settings}=fixture(),raw=storage.getItem(SCHEDULE_KEY);
  for(let i=0;i<3;i++){expect(loadScheduleSettings(storage,"fixture",248)).toEqual(settings);expect(needsOrderReview(loadScheduleSettings(storage,"fixture",248))).toBe(true);}
  expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
});
it.each(["update","keep"] as const)("resolves %s once across repeated reloads",decision=>{
  const {storage,settings}=fixture();const next=resolveOrderReview(storage,"fixture",248,decision,settings.recurrence);
  expect(next.recurrence.order).toEqual(decision==="update"?USUAL_EVENT_ORDER:oldOrder);
  const raw=storage.getItem(SCHEDULE_KEY);
  for(let i=0;i<3;i++){expect(needsOrderReview(loadScheduleSettings(storage,"fixture",248))).toBe(false);resolveOrderReview(storage,"fixture",248,decision,settings.recurrence);expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);}
});
it("changes only recurrence order, preserving disabled/manual cycles, exceptions, clocks and other storage",()=>{
  const {storage,settings}=fixture();settings.recurrence={...settings.recurrence,anchorDate:"2026-11-10",intervalDays:21,enabled:false};
  settings.cycles=[{...exampleCycle(),source:"player-configured",startDate:"2026-11-12",enabled:false,order:[...oldOrder],exceptions:[{eventId:"cyber",date:"2026-11-15",time:"02:00:00",skip:true}]}];
  const otherProfile=defaultSettings("other",248),otherServer=defaultSettings("fixture",10004);
  otherProfile.recurrence.order=[...oldOrder];otherServer.recurrence.order=[...oldOrder];
  storage.setItem(SCHEDULE_KEY,JSON.stringify({version:3,entries:[settings,otherProfile,otherServer]}));
  for(const key of ["gorillalab.profiles","gorillalab.battles.v1","experiments","unrelated"])storage.setItem(key,"opaque unchanged fixture");
  const next=resolveOrderReview(storage,"fixture",248,"update",settings.recurrence);
  expect(next).toEqual({...settings,recurrence:{...settings.recurrence,order:[...USUAL_EVENT_ORDER]}});
  expect(loadScheduleSettings(storage,"other",248)).toEqual(otherProfile);expect(loadScheduleSettings(storage,"fixture",10004)).toEqual(otherServer);
  expect(needsOrderReview(loadScheduleSettings(storage,"other",248))).toBe(true);expect(needsOrderReview(loadScheduleSettings(storage,"fixture",10004))).toBe(true);
  for(const key of ["gorillalab.profiles","gorillalab.battles.v1","experiments","unrelated"])expect(storage.getItem(key)).toBe("opaque unchanged fixture");
});
it("does not offer arbitrary custom orders or rewrite manual orders matching the former default",()=>{
  const {storage,settings}=fixture();settings.recurrence.order=["wise","space","cyber","primal","armed","treasure","warlord"];
  settings.cycles=[{...exampleCycle(),order:[...oldOrder],source:"player-configured"}];
  storage.setItem(SCHEDULE_KEY,JSON.stringify({version:3,entries:[settings]}));const raw=storage.getItem(SCHEDULE_KEY);
  expect(needsOrderReview(settings)).toBe(false);resolveOrderReview(storage,"fixture",248,"update",settings.recurrence);expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
});
it("uses current defaults for missing entries without creating saved data",()=>{
  const storage=systemStorage();const settings=loadScheduleSettings(storage,"missing",248);expect(needsOrderReview(settings)).toBe(false);
  resolveOrderReview(storage,"missing",248,"update",settings.recurrence);expect(storage.getItem(SCHEDULE_KEY)).toBeNull();
});
it.each(['broken JSON','{"version":99,"entries":[]}','{"version":3,"entries":[{}]}'])("rejects malformed storage without overwriting: %s",raw=>{
  const {storage,settings}=fixture();storage.setItem(SCHEDULE_KEY,raw);expect(()=>resolveOrderReview(storage,"fixture",248,"update",settings.recurrence)).toThrow();expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
});
it("rejects stale confirmation if recurrence dates or settings changed after opening review",()=>{
  const {storage,settings}=fixture();const changed=structuredClone(settings);changed.recurrence.anchorDate="2026-11-09";
  storage.setItem(SCHEDULE_KEY,JSON.stringify({version:3,entries:[changed]}));const raw=storage.getItem(SCHEDULE_KEY);
  expect(()=>resolveOrderReview(storage,"fixture",248,"update",settings.recurrence)).toThrow(/changed since review/);expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
  const original=JSON.stringify({version:3,entries:[settings]});let reads=0;
  const changedDuringRead={getItem:()=>++reads===1?original:raw,setItem:()=>{throw new Error("Must not write stale settings");}};
  expect(()=>resolveOrderReview(changedDuringRead,"fixture",248,"update",settings.recurrence)).toThrow(/changed since review/);
});
it.each([1,2])("does not overwrite legacy version %s on load",version=>{
  const {storage,settings}=fixture();settings.cycles=[{...exampleCycle(),order:[...oldOrder]}];const entry:any=structuredClone(settings);if(version===1)delete entry.recurrence;
  storage.setItem(SCHEDULE_KEY,JSON.stringify({version,entries:[entry]}));const raw=storage.getItem(SCHEDULE_KEY);
  const loaded=loadScheduleSettings(storage,"fixture",248);expect(loaded.cycles).toEqual(settings.cycles);expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
});
it("rejects malformed review markers without silently dismissing review",()=>{
  const {storage,settings}=fixture();storage.setItem(SCHEDULE_KEY,JSON.stringify({version:3,entries:[{...settings,legacyOrderReview:"invalid"}]}));const raw=storage.getItem(SCHEDULE_KEY);
  expect(()=>loadScheduleSettings(storage,"fixture",248)).toThrow();expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
});
it("propagates a failed storage write without treating the review as resolved",()=>{
  const {storage,settings}=fixture(),raw=storage.getItem(SCHEDULE_KEY);
  const failing={getItem:storage.getItem,setItem:()=>{throw new Error("Storage full");}};
  expect(()=>resolveOrderReview(failing,"fixture",248,"update",settings.recurrence)).toThrow("Storage full");
  expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);expect(needsOrderReview(loadScheduleSettings(storage,"fixture",248))).toBe(true);
});
