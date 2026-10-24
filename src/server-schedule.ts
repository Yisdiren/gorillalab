import { eventDisplayName } from "./data/events";
import type { Storage } from "./profiles";

export const USUAL_EVENT_ORDER = ["space","wise","cyber","primal","armed","treasure","warlord"] as const;
export const SCHEDULE_KEY = "gorillalab.server-schedules.v1";
export const DAY_MS = 86_400_000;
export const CLOCK_MAX_AGE_MS = DAY_MS; // Application freshness policy, not a game rule.
export const CLOCK_JUMP_TOLERANCE_MS = 2000;
export type Cycle = { id:string; startDate:string; order:string[]; confirmed:boolean; enabled:boolean; source:"player-confirmed-example"|"player-configured"|"player-confirmed-recurrence"; replacesStartDate?:string; exceptions?:{eventId:string;date:string;time:string;skip:boolean}[] };
export type Calibration = { serverDateTime:string; clientAtSync:number; lastSeenClient:number; invalidated:boolean };
export type Recurrence = {enabled:boolean;anchorDate:string;intervalDays:number;order:string[]};
export const defaultRecurrence=():Recurrence=>({enabled:true,anchorDate:"2026-10-26",intervalDays:14,order:[...USUAL_EVENT_ORDER]});
export type ScheduleSettings = { recurrence:Recurrence; profileId:string; server:number; cycles:Cycle[]; calibration:Calibration|null; migrationNotice?:string };
const object=(v:unknown):v is Record<string,any>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const epoch=(v:unknown):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=8_640_000_000_000_000;
/** UTC getters are used only as timezone-independent CIVIL calendar arithmetic.
 * The resulting wall-axis value is NOT a verified game UTC instant or offset. */
function parseCivilCalendar(value:string,minYear:number,maxYear:number):number {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value))throw new Error("Enter the full ST year/date and 24-hour time, including seconds.");
  const [y,m,d,h,min,s]=value.match(/\d+/g)!.map(Number);
  if(y<minYear||y>maxYear||m<1||m>12||d<1||d>31||h>23||min>59||s>59)throw new Error("Invalid server date or time.");
  const axis=Date.UTC(y,m-1,d,h,min,s);
  if(new Date(axis).toISOString().slice(0,19)!==value)throw new Error("Invalid server calendar date.");
  return axis;
}
export function parseServerCivil(value:string):number {return parseCivilCalendar(value,2000,2199);}
// Derived weeks may straddle the input range. Padding keeps Jan 2000 / Dec 2199
// and bounded lookahead valid without expanding accepted calibration/save dates.
const calendarAxis=(value:string)=>parseCivilCalendar(value,1900,2299);
export function serverDate(value:number){return new Date(value).toISOString().slice(0,10);}
export function formatServerClock(value:number){return new Date(value).toISOString().slice(0,19).replace("T"," ")+" ST";}
export function addServerDays(date:string,days:number){if(!Number.isSafeInteger(days))throw new Error("Calendar days must be whole numbers.");const civil=new Date(calendarAxis(date+"T00:00:00"));civil.setUTCDate(civil.getUTCDate()+days);return serverDate(civil.getTime());}
export function serverWeekday(date:string){return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date(calendarAxis(date+"T00:00:00")).getUTCDay()];}
export function exampleCycle():Cycle{return {id:"example-2026-10-26",startDate:"2026-10-26",order:[...USUAL_EVENT_ORDER],confirmed:true,enabled:true,source:"player-confirmed-example"};}
export function defaultSettings(profileId:string,server:number):ScheduleSettings{return {profileId,server,cycles:[],calibration:null,recurrence:defaultRecurrence()};}
export function validCycle(c:unknown):c is Cycle {
  if(!object(c)||typeof c.id!=="string"||!c.id||c.id.length>100||typeof c.startDate!=="string"||typeof c.enabled!=="boolean"||typeof c.confirmed!=="boolean"||!["player-confirmed-example","player-configured","player-confirmed-recurrence"].includes(c.source)||!Array.isArray(c.order)||c.order.length!==7||new Set(c.order).size!==7||!c.order.every((id:unknown)=>USUAL_EVENT_ORDER.includes(id as typeof USUAL_EVENT_ORDER[number])))return false;
  try{parseServerCivil(c.startDate+"T00:00:00");parseServerCivil(addServerDays(c.startDate,6)+"T00:00:00");
if(c.replacesStartDate!==undefined)parseServerCivil(c.replacesStartDate+"T00:00:00");
if(c.exceptions!==undefined&&(!Array.isArray(c.exceptions)||c.exceptions.length>7||new Set(c.exceptions.map((e:any)=>e.eventId)).size!==c.exceptions.length||!c.exceptions.every((e:any)=>object(e)&&c.order.includes(e.eventId)&&typeof e.skip==="boolean"&&typeof e.date==="string"&&typeof e.time==="string"&&parseServerCivil(e.date+"T"+e.time))))return false;
return true;}catch{return false;}
}
export function validCalibration(c:unknown):c is Calibration {
  if(!object(c)||typeof c.serverDateTime!=="string"||!epoch(c.clientAtSync)||!epoch(c.lastSeenClient)||c.lastSeenClient<c.clientAtSync||typeof c.invalidated!=="boolean")return false;
  try{parseServerCivil(c.serverDateTime);return true;}catch{return false;}
}
export function validateSettings(s:unknown):s is ScheduleSettings {
  try {
  if(!object(s)||typeof s.profileId!=="string"||!s.profileId||!epoch(s.server)||!Array.isArray(s.cycles)||s.cycles.length>24||!s.cycles.every(validCycle)||new Set(s.cycles.map((c:Cycle)=>c.id)).size!==s.cycles.length||(s.calibration!==null&&!validCalibration(s.calibration)))return false;
  if(s.migrationNotice!==undefined&&(typeof s.migrationNotice!=="string"||s.migrationNotice.length>300))return false;
  try{const r=s.recurrence;if(!object(r)||typeof r.enabled!=="boolean"||!Number.isInteger(r.intervalDays)||r.intervalDays<7||r.intervalDays>366||!validCycle({...exampleCycle(),startDate:r.anchorDate,order:r.order}))return false;}catch{return false;}
if(new Set(s.cycles.map((c:Cycle)=>c.replacesStartDate??c.startDate)).size!==s.cycles.length)return false;
const dates=new Set<string>();
  for(const c of s.cycles as Cycle[])if(c.enabled)for(const o of cycleOccurrences(c).filter(o=>o.enabled)){const date=String(o.appearance);if(dates.has(date))return false;dates.add(date);if(s.recurrence.enabled){const base=cycleStartForDate(s.recurrence,o.date),other=resolvedCycle(s as ScheduleSettings,base);if(other.id!==c.id&&cycleOccurrences(other).some(candidate=>candidate.enabled&&candidate.appearance===o.appearance))return false;}}
  return true;
  }catch{return false;}
}
export function loadScheduleDocument(storage:Storage):{version:2;entries:ScheduleSettings[]} {
  const raw=storage.getItem(SCHEDULE_KEY);if(raw===null)return {version:2,entries:[]};
  const d=JSON.parse(raw);
  if(object(d)&&d.version===1&&Array.isArray(d.entries)){
    d.entries=d.entries.map((entry:unknown)=>{
      if(!object(entry))return entry;
      const explicit={...entry,recurrence:{...defaultRecurrence(),enabled:false}};
      // Validate the legacy explicit schedule first; never repair malformed data.
      if(!validateSettings(explicit))return entry;
      const recurring={...explicit,recurrence:{...defaultRecurrence(),enabled:explicit.cycles.some(c=>c.enabled)}};
      if(validateSettings(recurring))return recurring;
      // A valid old off-cadence cycle may overlap a new default recurrence.
      // Retain all of its dates and keep automatic recurrence off until chosen.
      return {...explicit,migrationNotice:"Legacy manual dates overlap the automatic rotation. Their dates are preserved; automatic recurrence remains disabled until you review and save recurrence settings."};
    });d.version=2;
  }
if(!object(d)||d.version!==2||!Array.isArray(d.entries)||d.entries.length>500||!d.entries.every(validateSettings)||new Set(d.entries.map((e:ScheduleSettings)=>JSON.stringify([e.profileId,e.server]))).size!==d.entries.length)throw new Error("Invalid saved server schedules; existing data has not been overwritten.");
  return structuredClone(d) as {version:2;entries:ScheduleSettings[]};
}
export function loadScheduleSettings(storage:Storage,profileId:string,server:number):ScheduleSettings {
  return loadScheduleDocument(storage).entries.find(e=>e.profileId===profileId&&e.server===server)??defaultSettings(profileId,server);
}
/** Re-read before updating so another profile/server's entry is never replaced. */
export function updateScheduleSettings(storage:Storage,profileId:string,server:number,update:(previous:ScheduleSettings)=>ScheduleSettings):ScheduleSettings {
  const d=loadScheduleDocument(storage),index=d.entries.findIndex(e=>e.profileId===profileId&&e.server===server);
  const next=update(index<0?defaultSettings(profileId,server):structuredClone(d.entries[index]));
  if(!validateSettings(next)||next.profileId!==profileId||next.server!==server)throw new Error("Invalid schedule: check dates, seven unique events and overlapping enabled cycles.");
  if(index<0){if(d.entries.length>=500)throw new Error("Schedule storage limit reached.");d.entries.push(next);}else d.entries[index]=next;
  storage.setItem(SCHEDULE_KEY,JSON.stringify(d));return structuredClone(next);
}
export function synchronizeServerClock(serverDateTime:string,clientAtSubmission:number):Calibration {
  parseServerCivil(serverDateTime);if(!epoch(clientAtSubmission))throw new Error("Invalid device clock timestamp.");
  return {serverDateTime,clientAtSync:clientAtSubmission,lastSeenClient:clientAtSubmission,invalidated:false};
}
export function estimateServerClock(calibration:Calibration|null,clientNow:number,runtime?:{wallStart:number;monoStart:number;monoNow:number}) {
  if(!calibration)return {status:"missing" as const,serverWall:null,reason:"Set server clock to enable a countdown."};
  if(!validCalibration(calibration)||!epoch(clientNow)||(runtime&&![runtime.wallStart,runtime.monoStart,runtime.monoNow].every(Number.isFinite)))return {status:"clock-changed" as const,serverWall:null,reason:"Invalid clock metadata; resync before using a countdown."};
  const elapsed=clientNow-calibration.clientAtSync;
  const jump=runtime?Math.abs((clientNow-runtime.wallStart)-(runtime.monoNow-runtime.monoStart)):0;
  if(calibration.invalidated||elapsed < -CLOCK_JUMP_TOLERANCE_MS||clientNow<calibration.lastSeenClient-CLOCK_JUMP_TOLERANCE_MS||jump>CLOCK_JUMP_TOLERANCE_MS)return {status:"clock-changed" as const,serverWall:null,reason:"Device clock change or suspended timer detected. Resync before using a countdown."};
  if(elapsed>CLOCK_MAX_AGE_MS)return {status:"stale" as const,serverWall:null,reason:"Calibration is older than 24 hours. Resync to restore the estimated countdown."};
  return {status:"fresh" as const,serverWall:parseServerCivil(calibration.serverDateTime)+Math.max(0,elapsed),reason:"Estimated ST from manual synchronization; game timezone remains unverified."};
}
export type Occurrence={appearanceTime:string;manualOverride:boolean;cycleId:string;date:string;eventId:string;name:string;appearance:number;confirmed:boolean;example:boolean;enabled:boolean};
export function cycleOccurrences(cycle:Cycle):Occurrence[]{return cycle.order.map((id,i)=>{
const exception=cycle.exceptions?.find(e=>e.eventId===id),date=exception?.date??addServerDays(cycle.startDate,i),appearanceTime=exception?.time??"00:30:00";
return {cycleId:cycle.id,date,eventId:id,name:eventDisplayName(id),appearance:calendarAxis(date+"T"+appearanceTime),appearanceTime,manualOverride:cycle.source==="player-configured",confirmed:cycle.confirmed,example:cycle.source==="player-confirmed-example",enabled:cycle.enabled&&!exception?.skip};});}
/** UTC civil calendar ordinals, independent of browser timezone and DST. */
export function cycleStartForDate(r:Recurrence,date:string){const days=Math.round((calendarAxis(date+"T00:00:00")-parseServerCivil(r.anchorDate+"T00:00:00"))/DAY_MS);return addServerDays(r.anchorDate,Math.floor(days/r.intervalDays)*r.intervalDays);}
export function resolvedCycle(settings:ScheduleSettings,startDate:string):Cycle{return settings.cycles.find(c=>(c.replacesStartDate??c.startDate)===startDate)??{id:"recurring-"+startDate,startDate,order:[...settings.recurrence.order],confirmed:true,enabled:settings.recurrence.enabled,source:"player-confirmed-recurrence"};}
export function scheduleState(input:readonly Cycle[]|ScheduleSettings,serverWall:number|null){
const settings=Array.isArray(input)?null:input as ScheduleSettings;
let cycles:readonly Cycle[]=Array.isArray(input)?input:settings!.cycles;let offWeek=false;
if(settings?.recurrence.enabled){const date=serverWall===null?settings.recurrence.anchorDate:serverDate(serverWall),start=cycleStartForDate(settings.recurrence,date),generated:Cycle[]=[];
// At most 24 manual cancellations: bounded lookahead always reaches a default cycle.
for(let i=-2;i<=27;i++){try{const d=addServerDays(start,i*settings.recurrence.intervalDays);calendarAxis(d+"T00:00:00");generated.push(resolvedCycle(settings,d));}catch{/* calendar boundary */}}
cycles=[...generated,...settings.cycles.filter(c=>!generated.some(g=>g.id===c.id))];offWeek=date>=addServerDays(start,7);}
const enabled=cycles.flatMap(cycleOccurrences).filter(o=>o.enabled).sort((a,b)=>a.appearance-b.appearance||a.eventId.localeCompare(b.eventId));
if(serverWall===null)return {today:null,current:null,next:enabled.find(o=>o.date>=(settings?.recurrence.anchorDate??""))??enabled[0]??null,countdownSeconds:null,phase:"clock-required" as const};
const todays=enabled.filter(o=>o.date===serverDate(serverWall)),today=[...todays].reverse().find(o=>o.appearance<=serverWall)??todays[0]??null;
const current=[...enabled].reverse().find(o=>o.confirmed&&o.appearance<=serverWall)??null,next=enabled.find(o=>o.appearance>serverWall)??null;
const phase=!today?(offWeek?"off-week":"unscheduled"):!today.confirmed?"unconfirmed":serverWall<today.appearance?"pre-appearance":"appearance-reached";
return {today,current,next,countdownSeconds:next?.confirmed?Math.ceil((next.appearance-serverWall)/1000):null,phase};}
export function formatCountdown(seconds:number) {
  const n=Math.max(0,Math.floor(seconds)),d=Math.floor(n/86400),h=Math.floor(n%86400/3600),m=Math.floor(n%3600/60),s=n%60;
  return `${d?d+"d ":""}${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
