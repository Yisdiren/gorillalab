import {afterEach,expect,it} from "vitest";
import {absoluteToServerWall,calibrateFromUtc,defaultSettings,exampleCycle,estimateScheduleClock,formatServerClock,loadScheduleSettings,SCHEDULE_KEY,scheduleState,serverCivilToUtc,synchronizeServerClock,updateScheduleSettings,CLOCK_MAX_AGE_MS} from "./server-schedule";
import {systemStorage} from "./test/system-fixtures";
const stamp=(s:string)=>Date.parse(s),settings=()=>defaultSettings("p",248);
const clock=(utc:string,s=settings())=>estimateScheduleClock(s,stamp(utc));
const state=(utc:string)=>scheduleState(settings(),clock(utc).serverWall);
const originalTZ=process.env.TZ;afterEach(()=>{if(originalTZ===undefined)delete process.env.TZ;else process.env.TZ=originalTZ;});
it.each([
 ["2026-10-24T16:26:04Z","2026-10-24 14:26:04 ST"],
 ["2026-10-26T02:00:00Z","2026-10-26 00:00:00 ST"],
 ["2026-10-26T02:30:00Z","2026-10-26 00:30:00 ST"],
 ["2026-11-09T02:30:00Z","2026-11-09 00:30:00 ST"]
])("converts absolute UTC %s to fixed UTC−2 once",(utc,expected)=>{expect(formatServerClock(absoluteToServerWall(stamp(utc)))).toBe(expected);expect(serverCivilToUtc(expected.slice(0,19).replace(" ","T"))).toBe(stamp(utc));});
it.each([
 ["2026-10-26T02:00:00Z","2026-10-25 22:00:00"],
 ["2026-10-26T02:30:00Z","2026-10-25 22:30:00"],
 ["2026-11-09T02:00:00Z","2026-11-08 21:00:00"],
 ["2026-11-09T02:30:00Z","2026-11-08 21:30:00"]
])("matches EDT/EST local reset and appearance for %s",(utc,local)=>{
 expect(new Intl.DateTimeFormat("sv-SE",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(stamp(utc))).toBe(local);
 expect(formatServerClock(clock(utc).serverWall!)).toContain(utc.includes("02:00")?"00:00:00 ST":"00:30:00 ST");
});
it.each(["America/New_York","America/Los_Angeles","America/Kentucky/Louisville","Europe/London","Asia/Kolkata","Australia/Sydney","Pacific/Auckland","UTC"])("ignores browser timezone %s",zone=>{
 process.env.TZ=zone;const c=clock("2026-10-26T02:29:59Z");expect(formatServerClock(c.serverWall!)).toBe("2026-10-26 00:29:59 ST");expect(scheduleState(settings(),c.serverWall).countdownSeconds).toBe(1);
});
it.each([
 ["2026-03-08T06:59:59Z","2026-03-08T07:00:00Z","2026-03-08 05:00:00 ST"],
 ["2026-11-01T05:59:59Z","2026-11-01T06:00:00Z","2026-11-01 04:00:00 ST"]
])("keeps ST continuous across US DST at %s",(before,after,expected)=>{process.env.TZ="America/New_York";expect(clock(after).serverWall!-clock(before).serverWall!).toBe(1000);expect(formatServerClock(clock(after).serverWall!)).toBe(expected);});
it("crosses 23:59:59 to midnight, the reset gap and exact appearance",()=>{
 expect(formatServerClock(clock("2026-10-26T01:59:59Z").serverWall!)).toBe("2026-10-25 23:59:59 ST");expect(state("2026-10-26T02:00:00Z").phase).toBe("pre-appearance");expect(state("2026-10-26T02:00:00Z").countdownSeconds).toBe(1800);
 expect(state("2026-10-26T02:29:59Z").countdownSeconds).toBe(1);expect(state("2026-10-26T02:30:00Z").phase).toBe("appearance-reached");expect(state("2026-10-26T02:30:00Z").next?.eventId).toBe("wise");
});
it("preserves the 14-day rotation and seven off-days under automatic time",()=>{
 for(let day=2;day<=8;day++){const s=state(`2026-11-${String(day).padStart(2,"0")}T14:00:00Z`);expect(s.phase).toBe("off-week");expect(s.today).toBeNull();expect(s.next?.date).toBe("2026-11-09");}
 expect(state("2026-11-09T02:00:00Z").today?.eventId).toBe("space");expect(state("2026-11-23T02:30:00Z").today?.eventId).toBe("space");
});
it.each([1,2])("migrates version %i to automatic without deleting prior calibration or preferences",version=>{
 const storage=systemStorage(),calibration=synchronizeServerClock("2026-10-26T00:15:00",stamp("2026-10-26T02:15:00Z"));
 const legacy={...settings(),cycles:[exampleCycle()],calibration,clockMode:"manual"};const raw=JSON.stringify({version,entries:[legacy]});storage.setItem(SCHEDULE_KEY,raw);
 const loaded=loadScheduleSettings(storage,"p",248);expect(loaded.clockMode).toBe("automatic");expect(loaded.calibration).toEqual(calibration);expect(loaded.recurrence).toEqual(legacy.recurrence);expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
 updateScheduleSettings(storage,"p",248,s=>({...s,clockMode:"manual"}));expect(loadScheduleSettings(storage,"p",248).calibration).toEqual(calibration);expect(JSON.parse(storage.getItem(SCHEDULE_KEY)!).version).toBe(3);
});
it("keeps mode and both calibrations isolated across profiles and servers after reload",()=>{
 const storage=systemStorage(),calibration=synchronizeServerClock("2026-10-26T00:15:00",stamp("2026-10-26T02:15:00Z"));updateScheduleSettings(storage,"p",248,s=>({...s,clockMode:"manual",calibration}));
 expect(loadScheduleSettings(storage,"p",248).clockMode).toBe("manual");expect(loadScheduleSettings(storage,"p",260).clockMode).toBe("automatic");expect(loadScheduleSettings(storage,"other",248).calibration).toBeNull();
 updateScheduleSettings(storage,"p",248,s=>({...s,clockMode:"automatic"}));expect(loadScheduleSettings(storage,"p",248).calibration).toEqual(calibration);
});
it("cannot detect an initially wrong device clock, but reference UTC can correct its estimate",()=>{
 const wrong=stamp("2026-10-26T02:45:00Z"),s=settings();expect(formatServerClock(estimateScheduleClock(s,wrong).serverWall!)).toContain("00:45:00 ST");
 s.referenceCalibration=calibrateFromUtc("2026-10-26T02:29:59",wrong);s.clockMode="reference";
 expect(scheduleState(s,estimateScheduleClock(s,wrong).serverWall).countdownSeconds).toBe(1);expect(formatServerClock(estimateScheduleClock(s,wrong+1000).serverWall!)).toContain("00:30:00 ST");
 expect(estimateScheduleClock(s,wrong+CLOCK_MAX_AGE_MS+1).status).toBe("stale");
});
it("does not expire automatic mode or reuse/invalidate old manual calibration",()=>{
 const s=settings(),now=stamp("2026-10-26T02:00:00Z");s.calibration={...synchronizeServerClock("2026-10-26T00:00:00",now),invalidated:true};const before=structuredClone(s.calibration);
 expect(estimateScheduleClock(s,now+2*CLOCK_MAX_AGE_MS).status).toBe("fresh");expect(s.calibration).toEqual(before);
});
it("flags session device-clock jumps but cannot independently authenticate time",()=>{
 const now=stamp("2026-10-26T02:00:00Z"),s=settings();expect(estimateScheduleClock(s,now+60_000,{wallStart:now,monoStart:0,monoNow:1000}).status).toBe("clock-changed");
 expect(estimateScheduleClock(s,now+1000,{wallStart:now,monoStart:0,monoNow:1000}).status).toBe("fresh");expect(estimateScheduleClock(s,NaN).serverWall).toBeNull();
});
it("rejects unknown clock modes without replacing saved schedules",()=>{
 const storage=systemStorage(),raw=JSON.stringify({version:3,entries:[{...settings(),clockMode:"guess"}]});storage.setItem(SCHEDULE_KEY,raw);expect(()=>loadScheduleSettings(storage,"p",248)).toThrow(/not been overwritten/);expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
});
