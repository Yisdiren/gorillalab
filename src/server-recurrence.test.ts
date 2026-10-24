import {expect,it} from "vitest";
import {addServerDays,cycleOccurrences,cycleStartForDate,defaultSettings,exampleCycle,loadScheduleSettings,parseServerCivil,resolvedCycle,SCHEDULE_KEY,scheduleState,synchronizeServerClock,updateScheduleSettings,validateSettings} from "./server-schedule";
import {systemStorage} from "./test/system-fixtures";
const settings=()=>defaultSettings("p",248);
const at=(date:string,time="12:00:00",s=settings())=>scheduleState(s,parseServerCivil(date+"T"+time));
it.each(["2026-10-26","2026-11-09","2026-11-23","2026-12-07","2026-12-21"])("calculates seven consecutive days from %s",start=>{
 const s=settings(),c=resolvedCycle(s,start);expect(cycleStartForDate(s.recurrence,addServerDays(start,6))).toBe(start);
 expect(cycleOccurrences(c).map(o=>o.eventId)).toEqual(["space","wise","cyber","primal","armed","treasure","warlord"]);
 for(let i=0;i<7;i++)expect(at(addServerDays(start,i)).today?.eventId).toBe(c.order[i]);
});
it.each([2,3,4,5,6,7,8])("November %i is an off-week day with no active-day event",day=>{
 const s=at(`2026-11-${String(day).padStart(2,"0")}`);expect(s.phase).toBe("off-week");expect(s.today).toBeNull();expect(s.next?.date).toBe("2026-11-09");expect(s.next?.eventId).toBe("space");expect(s.current?.date).toBe("2026-11-01");
});
it("handles reset, appearance and Sunday to off-week boundaries",()=>{
 expect(at("2026-11-09","00:00:00").countdownSeconds).toBe(1800);expect(at("2026-11-09","00:00:00").phase).toBe("pre-appearance");
 expect(at("2026-11-09","00:30:00").phase).toBe("appearance-reached");expect(at("2026-11-01","00:30:00").next?.date).toBe("2026-11-09");expect(at("2026-11-02","00:00:00").today).toBeNull();
});
it("uses floor division before the anchor and navigates years/leap dates",()=>{
 const r=settings().recurrence;expect(cycleStartForDate(r,"2026-10-25")).toBe("2026-10-12");expect(at("2026-10-12").today?.eventId).toBe("space");
 expect(addServerDays("2027-12-27",14)).toBe("2028-01-10");expect(addServerDays("2028-02-21",14)).toBe("2028-03-06");
 expect(cycleStartForDate(r,"2028-02-29")).toBe("2028-02-28");expect(at("2028-02-29").today?.eventId).toBe("wise");
});
it("preserves manual changed order, skipped cycles, delays and individual exceptions",()=>{
 const s=settings();s.cycles=[{...exampleCycle(),id:"override",source:"player-configured",startDate:"2026-11-10",replacesStartDate:"2026-11-09",order:["wise","space","cyber","primal","armed","treasure","warlord"],exceptions:[{eventId:"wise",date:"2026-11-10",time:"02:00:00",skip:false},{eventId:"space",date:"2026-11-11",time:"00:30:00",skip:true}]}];
 expect(validateSettings(s)).toBe(true);expect(at("2026-11-09","12:00:00",s).today).toBeNull();expect(at("2026-11-10","01:00:00",s).countdownSeconds).toBe(3600);expect(at("2026-11-11","12:00:00",s).today).toBeNull();
 s.cycles[0].enabled=false;expect(at("2026-11-08","12:00:00",s).next?.date).toBe("2026-11-23");
});
it("migrates legacy one-offs without writing or changing clock/order/preferences",()=>{
 const storage=systemStorage(),cycle={...exampleCycle(),enabled:false},calibration=synchronizeServerClock("2026-10-26T00:00:00",100000);
 const raw=JSON.stringify({version:1,entries:[{profileId:"p",server:248,cycles:[cycle],calibration}]});storage.setItem(SCHEDULE_KEY,raw);
 const s=loadScheduleSettings(storage,"p",248);expect(s.cycles).toEqual([cycle]);expect(s.calibration).toEqual(calibration);expect(s.recurrence.enabled).toBe(false);expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
 updateScheduleSettings(storage,"p",248,s=>s);expect(JSON.parse(storage.getItem(SCHEDULE_KEY)!).version).toBe(2);
});
it("migrates enabled legacy cycles as overrides and never auto-confirms an unconfirmed cycle",()=>{
 const storage=systemStorage(),cycle={...exampleCycle(),id:"future",startDate:"2026-11-09",confirmed:false};storage.setItem(SCHEDULE_KEY,JSON.stringify({version:1,entries:[{profileId:"p",server:248,cycles:[cycle],calibration:null}]}));
 const s=loadScheduleSettings(storage,"p",248);expect(s.recurrence.enabled).toBe(true);expect(at("2026-11-08","12:00:00",s).countdownSeconds).toBeNull();expect(s.cycles[0]).toEqual(cycle);
});
it("isolates persisted cadence, reload and exceptions from other profiles and servers",()=>{
 const storage=systemStorage();updateScheduleSettings(storage,"p",248,s=>({...s,recurrence:{...s.recurrence,intervalDays:21},cycles:[{...exampleCycle(),exceptions:[{eventId:"space",date:"2026-10-26",time:"01:00:00",skip:false}]}]}));
 expect(loadScheduleSettings(storage,"p",248).recurrence.intervalDays).toBe(21);expect(loadScheduleSettings(storage,"p",260).recurrence.intervalDays).toBe(14);expect(loadScheduleSettings(storage,"other",248).cycles).toEqual([]);expect(loadScheduleSettings(storage,"p",248).cycles[0].exceptions?.[0].time).toBe("01:00:00");
});
it("does not use local timezone or DST when recurring",()=>{
 const previous=process.env.TZ;try{for(const zone of ["UTC","America/New_York","Europe/London","Asia/Tokyo"]){process.env.TZ=zone;expect(at("2026-11-08").next?.date).toBe("2026-11-09");expect(cycleStartForDate(settings().recurrence,"2027-03-14")).toBe("2027-03-01");}}finally{process.env.TZ=previous;}
});
it("rejects conflicting delayed cycles and malformed exception times without overwriting saved schedules",()=>{
 const storage=systemStorage();updateScheduleSettings(storage,"p",248,s=>s);const before=storage.getItem(SCHEDULE_KEY);
 expect(()=>updateScheduleSettings(storage,"p",248,s=>({...s,cycles:[{...exampleCycle(),id:"delay",startDate:"2026-11-23",replacesStartDate:"2026-11-09"}]}))).toThrow();expect(storage.getItem(SCHEDULE_KEY)).toBe(before);
 const s=settings();s.cycles=[{...exampleCycle(),exceptions:[{eventId:"space",date:"2026-10-26",time:"25:00:00",skip:false}]}];expect(validateSettings(s)).toBe(false);
});
it.each(["2000-01-01","2000-01-03","2199-12-25","2199-12-31"])("resolves dates at calendar limits without throwing: %s",date=>{
 const s=at(date,"00:00:00");expect(s.next).not.toBeNull();expect(s.countdownSeconds).toBeGreaterThan(0);
 const cycle=resolvedCycle(settings(),cycleStartForDate(settings().recurrence,date));expect(cycleOccurrences(cycle)).toHaveLength(7);
});
it("preserves a valid off-cadence legacy cycle instead of rejecting its migration",()=>{
 const storage=systemStorage(),cycle={...exampleCycle(),id:"shifted",startDate:"2026-10-27",source:"player-configured" as const};
 const raw=JSON.stringify({version:1,entries:[{profileId:"p",server:248,cycles:[cycle],calibration:null}]});storage.setItem(SCHEDULE_KEY,raw);
 const migrated=loadScheduleSettings(storage,"p",248);expect(migrated.cycles).toEqual([cycle]);expect(migrated.recurrence.enabled).toBe(false);expect(migrated.migrationNotice).toContain("dates are preserved");expect(at("2026-10-27","00:00:00",migrated).next?.eventId).toBe("space");expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
 updateScheduleSettings(storage,"p",248,s=>s);expect(loadScheduleSettings(storage,"p",248).cycles).toEqual([cycle]);
});
it("still rejects malformed legacy entries without changing storage",()=>{
 const storage=systemStorage();for(const cycles of [[null],[{...exampleCycle(),order:["space"]}]]){const raw=JSON.stringify({version:1,entries:[{profileId:"p",server:248,cycles,calibration:null}]});storage.setItem(SCHEDULE_KEY,raw);expect(()=>loadScheduleSettings(storage,"p",248)).toThrow(/not been overwritten/);expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);}
});
it("honors the full allowed set of cancelled cycles before finding the next rotation",()=>{
 const s=settings();s.cycles=Array.from({length:24},(_,i)=>({...exampleCycle(),id:"skip-"+i,startDate:addServerDays("2026-10-26",i*14),enabled:false}));expect(validateSettings(s)).toBe(true);
 expect(at("2026-10-26","00:00:00",s).next?.date).toBe(addServerDays("2026-10-26",24*14));expect(at("2026-10-26","00:00:00",s).today).toBeNull();
});
it("reaches a delayed same-day exception after the earlier event without claiming its availability",()=>{
 const s=settings();s.cycles=[{...exampleCycle(),exceptions:[{eventId:"space",date:"2026-10-27",time:"02:00:00",skip:false}]}];expect(validateSettings(s)).toBe(true);
 const between=at("2026-10-27","01:00:00",s);expect(between.today?.eventId).toBe("wise");expect(between.next?.eventId).toBe("space");expect(between.countdownSeconds).toBe(3600);expect(at("2026-10-27","02:00:00",s).today?.eventId).toBe("space");
});
