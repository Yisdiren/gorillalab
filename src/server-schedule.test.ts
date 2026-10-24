import {afterEach,expect,it} from "vitest";
import {CLOCK_MAX_AGE_MS,DAY_MS,SCHEDULE_KEY,USUAL_EVENT_ORDER,addServerDays,cycleOccurrences,defaultSettings,estimateServerClock,exampleCycle,formatCountdown,formatServerClock,loadScheduleSettings,parseServerCivil,scheduleState,serverWeekday,synchronizeServerClock,updateScheduleSettings,validCalibration,validateSettings} from "./server-schedule";
import {systemProfile,systemStorage} from "./test/system-fixtures";
import {saveProfile,STORAGE_KEY} from "./profiles";
const axis=(value:string)=>parseServerCivil(value);
const cycle=()=>[exampleCycle()];
const client=Date.parse("2026-10-24T12:00:00Z"); // Synthetic client instant, NOT a game UTC offset.
const oldTZ=process.env.TZ;
afterEach(()=>{if(oldTZ===undefined)delete process.env.TZ;else process.env.TZ=oldTZ;});
it("maps only the supplied Oct 26–Nov 1 cycle in ST and puts Cyber before Primal",()=>{
 const rows=cycleOccurrences(exampleCycle());
 expect(rows.map(r=>[r.date,r.eventId])).toEqual([["2026-10-26","space"],["2026-10-27","wise"],["2026-10-28","cyber"],["2026-10-29","primal"],["2026-10-30","armed"],["2026-10-31","treasure"],["2026-11-01","warlord"]]);
 expect(rows.every(r=>formatServerClock(r.appearance).endsWith("00:30:00 ST"))).toBe(true);
 expect(serverWeekday(rows[0].date)).toBe("Monday");expect(rows[6].name).toBe("Gorilla Warlord");
});
it("resets the ST day at midnight and handles 00:00–00:29 without claiming appearance",()=>{
 const before=scheduleState(cycle(),axis("2026-10-26T23:59:59"));expect(before.phase).toBe("appearance-reached");expect(before.today?.eventId).toBe("space");
 const reset=scheduleState(cycle(),axis("2026-10-27T00:00:00"));expect(reset.phase).toBe("pre-appearance");expect(reset.today?.eventId).toBe("wise");expect(reset.countdownSeconds).toBe(1800);
 expect(scheduleState(cycle(),axis("2026-10-27T00:29:59")).countdownSeconds).toBe(1);
});
it("at exactly ST 00:30 marks the scheduled threshold and counts separately toward the next day",()=>{
 const state=scheduleState(cycle(),axis("2026-10-28T00:30:00"));
 expect(state.phase).toBe("appearance-reached");expect(state.current?.eventId).toBe("cyber");expect(state.next?.eventId).toBe("primal");expect(state.countdownSeconds).toBe(86400);
 const after=scheduleState(cycle(),axis("2026-10-28T22:00:00"));expect(after.phase).toBe("appearance-reached");expect(after.current?.eventId).toBe("cyber");
});
it("handles week/month/leap/year rollovers and rejects impossible civil dates",()=>{
 expect(addServerDays("2026-10-31",1)).toBe("2026-11-01");expect(serverWeekday("2026-11-01")).toBe("Sunday");
 expect(addServerDays("2026-12-31",1)).toBe("2027-01-01");expect(addServerDays("2028-02-28",1)).toBe("2028-02-29");
 for(const value of ["2026-02-29T00:00:00","2026-10-24T24:00:00","2026-10-24T14:26","2026-10-24T14:26:04Z","2026-13-01T00:00:00"])expect(()=>axis(value)).toThrow();
});
it("does not infer a weekly cycle or an end time after the last known appearance",()=>{
 const ended=scheduleState(cycle(),axis("2026-11-02T00:30:00"));expect(ended.phase).toBe("unscheduled");expect(ended.next).toBeNull();expect(ended.countdownSeconds).toBeNull();expect(ended.current?.eventId).toBe("warlord");
 expect(scheduleState(cycle(),axis("2026-11-09T00:30:00")).next).toBeNull();
});
it("shows no numeric countdown for missing, stale or device-invalidated calibration",()=>{
 expect(estimateServerClock(null,client).status).toBe("missing");const c=synchronizeServerClock("2026-10-24T14:26:04",client);
 expect(estimateServerClock(c,client+CLOCK_MAX_AGE_MS+1).status).toBe("stale");
 expect(estimateServerClock({...c,invalidated:true},client).status).toBe("clock-changed");
 expect(estimateServerClock(c,client-3000).status).toBe("clock-changed");
 expect(estimateServerClock({...c,lastSeenClient:client+60_000},client+10_000).status).toBe("clock-changed");
 expect(estimateServerClock(c,client+61_000,{wallStart:client,monoStart:0,monoNow:1000}).status).toBe("clock-changed");
 expect(scheduleState(cycle(),null).countdownSeconds).toBeNull();
});
it("advances by absolute elapsed time, persists across reload and permits explicit recalibration",()=>{
 const storage=systemStorage();const c=synchronizeServerClock("2026-10-26T00:29:30",client);
 updateScheduleSettings(storage,"p",248,s=>({...s,calibration:c}));
 const loaded=loadScheduleSettings(storage,"p",248);const clock=estimateServerClock(loaded.calibration,client+10_000,{wallStart:client+10_000,monoStart:1,monoNow:1});
 expect(clock.status).toBe("fresh");expect(scheduleState(loaded,clock.serverWall).countdownSeconds).toBe(20);
 const next=updateScheduleSettings(storage,"p",248,s=>({...s,calibration:synchronizeServerClock("2026-10-26T00:29:50",client+10_000)}));
 expect(scheduleState(next,estimateServerClock(next.calibration,client+10_000).serverWall).countdownSeconds).toBe(10);
 expect(validCalibration(next.calibration)).toBe(true);
});
it("isolates settings by profile AND server and preserves other storage keys",()=>{
 const storage=systemStorage(),profile=systemProfile();saveProfile(storage,profile);storage.setItem("gorillalab.battles.v1","preserved history");storage.setItem("gorillalab.ratio-tests.v1","preserved ratios");const before=storage.getItem(STORAGE_KEY);
 updateScheduleSettings(storage,"p",248,s=>({...s,calibration:synchronizeServerClock("2026-10-24T14:26:04",client)}));
 expect(loadScheduleSettings(storage,"other",248).calibration).toBeNull();expect(loadScheduleSettings(storage,"p",260).calibration).toBeNull();
 updateScheduleSettings(storage,"other",260,s=>({...s,cycles:[]}));expect(loadScheduleSettings(storage,"p",248).calibration).not.toBeNull();
 expect(storage.getItem(STORAGE_KEY)).toBe(before);expect(storage.getItem("gorillalab.battles.v1")).toBe("preserved history");expect(storage.getItem("gorillalab.ratio-tests.v1")).toBe("preserved ratios");
});
it("supports explicit changed orders, inactive cycles and unconfirmed future dates",()=>{
 const order=[...USUAL_EVENT_ORDER];[order[2],order[3]]=[order[3],order[2]];
 const changed={...exampleCycle(),order};expect(cycleOccurrences(changed)[2].eventId).toBe("primal");
 const next={...exampleCycle(),id:"future",startDate:"2026-11-09",confirmed:false,source:"player-configured" as const};
 const planned=scheduleState([next],axis("2026-11-08T12:00:00"));expect(planned.next?.confirmed).toBe(false);expect(planned.countdownSeconds).toBeNull();
 expect(scheduleState([{...next,enabled:false}],axis("2026-11-08T12:00:00")).next).toBeNull();
 expect(scheduleState([next],axis("2026-11-09T00:30:00")).phase).toBe("unconfirmed");
});
it("rejects duplicate events, overlapping cycles, invalid metadata and corrupt/future saves atomically",()=>{
 const storage=systemStorage();const c=exampleCycle();expect(validateSettings({...defaultSettings("p",248),cycles:[c,{...c,id:"overlap",startDate:"2026-10-27"}]})).toBe(false);
 expect(validateSettings({...defaultSettings("p",248),cycles:[{...c,order:Array(7).fill("space")}]})).toBe(false);
 storage.setItem(SCHEDULE_KEY,'{"version":99}');expect(()=>updateScheduleSettings(storage,"p",248,s=>s)).toThrow(/overwritten/);expect(storage.getItem(SCHEDULE_KEY)).toBe('{"version":99}');
 expect(validCalibration({serverDateTime:"2026-10-24T00:00:00",clientAtSync:client,lastSeenClient:client-1,invalidated:false})).toBe(false);
});
it("is invariant under host timezones and a local DST transition",()=>{
 const c=synchronizeServerClock("2026-11-01T00:29:59",Date.parse("2026-11-01T05:59:59Z"));
 const states:string[][]=[];
 for(const timezone of ["UTC","America/New_York","Asia/Tokyo","Pacific/Honolulu","Europe/Berlin"]){process.env.TZ=timezone;const now=Date.parse("2026-11-01T06:00:00Z"),clock=estimateServerClock(c,now);states.push([formatServerClock(clock.serverWall!),scheduleState(cycle(),clock.serverWall).phase,addServerDays("2026-10-31",1)]);}
 expect(states.every(s=>JSON.stringify(s)===JSON.stringify(states[0]))).toBe(true);expect(states[0]).toEqual(["2026-11-01 00:30:00 ST","appearance-reached","2026-11-01"]);
});
it("formats a nonnegative day/hour/minute/second countdown without claiming real availability",()=>{
 expect(formatCountdown(DAY_MS/1000+3661)).toBe("1d 01:01:01");expect(formatCountdown(0)).toBe("00:00:00");expect(formatCountdown(-1)).toBe("00:00:00");
});

it("does not import the host spring-forward jump into the estimated ST clock",()=>{
 process.env.TZ="America/New_York";
 const before=Date.parse("2026-03-08T06:59:59Z"),after=Date.parse("2026-03-08T07:00:00Z");
 const calibration=synchronizeServerClock("2026-03-08T00:29:59",before);
 const clock=estimateServerClock(calibration,after);
 expect(formatServerClock(clock.serverWall!)).toBe("2026-03-08 00:30:00 ST");
 expect(scheduleState([{...exampleCycle(),startDate:"2026-03-02"}],clock.serverWall).phase).toBe("appearance-reached");
});
