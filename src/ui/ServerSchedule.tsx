import { useEffect, useState } from "react";
import { eventDisplayName } from "../data/events";
import type { PlayerProfile, Storage } from "../profiles";
import { addServerDays, cycleStartForDate, resolvedCycle, serverDate, parseServerCivil, SCHEDULE_KEY, USUAL_EVENT_ORDER, cycleOccurrences, defaultSettings, estimateServerClock, formatCountdown, formatServerClock, loadScheduleSettings, scheduleState, serverWeekday, synchronizeServerClock, updateScheduleSettings, type Cycle, type ScheduleSettings } from "../server-schedule";

const wallNow=()=>Date.now();const monoNow=()=>performance.now();
export function ServerSchedule({profile,storage,now=wallNow,monotonic=monoNow}:{profile:PlayerProfile|null;storage:Storage;now?:()=>number;monotonic?:()=>number}) {
  const profileId=profile?.id??"preview",server=profile?.serverNumber??null;
  const canSave=!!profile&&server!==null;
  const [initial]=useState(()=>{try{return {settings:canSave?loadScheduleSettings(storage,profileId,server!):defaultSettings(profileId,0),error:""};}catch(e){return {settings:defaultSettings(profileId,server??0),error:String(e)};}});
  const [settings,setSettings]=useState(initial.settings),[error,setError]=useState(initial.error),[message,setMessage]=useState("");
  const [runtime,setRuntime]=useState(()=>({wallStart:now(),monoStart:monotonic()}));
  const [tick,setTick]=useState(()=>({wall:now(),mono:monotonic()}));
  const [clockOpen,setClockOpen]=useState(false),[configOpen,setConfigOpen]=useState(false);
  const [stDate,setStDate]=useState(""),[stTime,setStTime]=useState("");
  const [cycleId,setCycleId]=useState(""),[startDate,setStartDate]=useState(""),[order,setOrder]=useState<string[]>([...settings.recurrence.order]);
  const [confirmed,setConfirmed]=useState(false),[enabled,setEnabled]=useState(true);
  const clock=estimateServerClock(settings.calibration,tick.wall,{...runtime,monoNow:tick.mono});
  const state=scheduleState(settings,clock.serverWall);
  const [viewStart,setViewStart]=useState<string|null>(null),[replacement,setReplacement]=useState("");
  const [exceptions,setExceptions]=useState<NonNullable<Cycle["exceptions"]>>([]);
  const [recurrenceOrder,setRecurrenceOrder]=useState([...settings.recurrence.order]);
  const [anchor,setAnchor]=useState(settings.recurrence.anchorDate),[interval,setIntervalDays]=useState(settings.recurrence.intervalDays),[recurring,setRecurring]=useState(settings.recurrence.enabled);
  const automaticStart=cycleStartForDate(settings.recurrence,clock.serverWall===null?settings.recurrence.anchorDate:serverDate(clock.serverWall));
  const manualCycles=[...settings.cycles].sort((a,b)=>(a.replacesStartDate??a.startDate).localeCompare(b.replacesStartDate??b.startDate));
  const manualDefault=manualCycles.find(c=>cycleOccurrences(c).some(o=>clock.serverWall!==null&&o.date===serverDate(clock.serverWall)))??manualCycles.find(c=>clock.serverWall===null||cycleOccurrences(c).some(o=>o.appearance>clock.serverWall!))??manualCycles.at(-1);
  const displayedStart=viewStart??(!settings.recurrence.enabled&&manualDefault?(manualDefault.replacesStartDate??manualDefault.startDate):state.phase==="off-week"?addServerDays(automaticStart,settings.recurrence.intervalDays):automaticStart);
  const displayedCycle=resolvedCycle(settings,displayedStart);
  function viewDate(value:string){try{parseServerCivil(value+"T00:00:00");setViewStart(cycleStartForDate(settings.recurrence,value));setError("");}catch{setError("Enter a supported full server date.");}}
  function navigate(days:number){try{
    if(!settings.recurrence.enabled&&manualCycles.length){const index=manualCycles.findIndex(c=>(c.replacesStartDate??c.startDate)===displayedStart),cycle=manualCycles[index+Math.sign(days)];if(cycle)setViewStart(cycle.replacesStartDate??cycle.startDate);return;}
    const d=addServerDays(cycleStartForDate(settings.recurrence,displayedStart),days);parseServerCivil(d+"T00:00:00");parseServerCivil(addServerDays(d,6)+"T00:00:00");cycleOccurrences(resolvedCycle(settings,d));setViewStart(d);
  }catch{setError("Supported server calendar: 2000–2199.");}}
  function saveRecurrence(){try{setSettings(updateScheduleSettings(storage,profileId,server!,previous=>({...previous,migrationNotice:undefined,recurrence:{...previous.recurrence,enabled:recurring,anchorDate:anchor,intervalDays:interval,order:[...recurrenceOrder]}})));setViewStart(null);setError("");setMessage("Recurring schedule saved for this profile/server only.");}catch(e){setError(String(e));}}
  useEffect(()=>{const timer=setInterval(()=>setTick({wall:now(),mono:monotonic()}),1000);return ()=>clearInterval(timer);},[now,monotonic]);
  // Persist fault/checkpoint metadata separately from every existing player-data key.
  useEffect(()=>{
    if(!canSave||!settings.calibration)return;
    const anchor=settings.calibration.clientAtSync;
    function checkpoint(){try{
      const wall=now(),mono=monotonic(),status=estimateServerClock(settings.calibration,wall,{...runtime,monoNow:mono});
      const next=updateScheduleSettings(storage,profileId,server!,previous=>{
        if(previous.calibration?.clientAtSync!==anchor)return previous;
        return {...previous,calibration:{...previous.calibration,lastSeenClient:Math.max(previous.calibration.lastSeenClient,wall),invalidated:previous.calibration.invalidated||status.status==="clock-changed"}};
      });setSettings(next);
    }catch(e){setError(String(e));}}
    const timer=setInterval(checkpoint,60_000);
    window.addEventListener("pagehide",checkpoint);
    const onVisibility=()=>{if(document.visibilityState==="hidden")checkpoint();};
    document.addEventListener("visibilitychange",onVisibility);
    return ()=>{clearInterval(timer);window.removeEventListener("pagehide",checkpoint);document.removeEventListener("visibilitychange",onVisibility);};
  },[canSave,profileId,server,settings.calibration?.clientAtSync,runtime,now,monotonic,storage]);
  useEffect(()=>{
    if(clock.status!=="clock-changed"||!canSave||!settings.calibration||settings.calibration.invalidated)return;
    try{const anchor=settings.calibration.clientAtSync;setSettings(updateScheduleSettings(storage,profileId,server!,previous=>previous.calibration?.clientAtSync===anchor?{...previous,calibration:{...previous.calibration,invalidated:true}}:previous));}catch(e){setError(String(e));}
  },[clock.status,canSave,profileId,server,settings.calibration,storage]);
  function sync(){try{
    if(!canSave)throw new Error("Select a profile with a server number before saving a server clock.");
    const clientAtSubmission=now(),calibration=synchronizeServerClock(stDate+"T"+stTime,clientAtSubmission);
    setSettings(updateScheduleSettings(storage,profileId,server!,previous=>({...previous,calibration})));
    const mono=monotonic();setRuntime({wallStart:clientAtSubmission,monoStart:mono});setTick({wall:clientAtSubmission,mono});
    setError("");setMessage("Estimated ST synchronized for this profile/server only.");setClockOpen(false);
  }catch(e){setError(String(e));}}
  function editCycle(id:string){setCycleId(id);const cycle=settings.cycles.find(c=>c.id===id);setStartDate(cycle?.startDate??"");setReplacement(cycle?.replacesStartDate??cycle?.startDate??"");setExceptions(cycle?.exceptions??[]);setOrder(cycle?[...cycle.order]:[...settings.recurrence.order]);setConfirmed(cycle?.confirmed??false);setEnabled(cycle?.enabled??true);}
  function saveCycle(){try{
    if(!canSave)throw new Error("Select a profile and server first.");
    const cycle:Cycle={id:cycleId||crypto.randomUUID(),startDate,order:[...order],confirmed,enabled,source:"player-configured",replacesStartDate:replacement||startDate,exceptions};
    setSettings(updateScheduleSettings(storage,profileId,server!,previous=>({...previous,cycles:[...previous.cycles.filter(c=>c.id!==cycle.id),cycle]})));
    setCycleId(cycle.id);setError("");setMessage("Cycle saved only for this profile/server. Manual override takes precedence over automatic recurrence.");
  }catch(e){setError(String(e));}}
  return <section className="panel server-schedule" aria-labelledby="next-gorilla-title">
    <div className="schedule-heading"><div><span className="eyebrow">SERVER-TIME SCHEDULE · ST</span><h2 id="next-gorilla-title">Next Gorilla</h2></div><button className="secondary" disabled={!canSave} aria-expanded={clockOpen} onClick={()=>{if(!clockOpen){setStDate("");setStTime("");}setClockOpen(!clockOpen);}}>{settings.calibration?"Resync server clock":"Set server clock"}</button></div>
    {clock.status==="fresh"&&clock.serverWall!==null?<p className="estimated-clock">Estimated ST <time>{formatServerClock(clock.serverWall)}</time></p>:<p className="muted">{clock.reason}</p>}
    <div className="next-gorilla-summary">
      {state.next?<>{clock.status!=="fresh"&&<small>First configured appearance — a fresh server clock is needed to determine what is next.</small>}<strong>{state.next.name}</strong><span>{serverWeekday(state.next.date)} · {state.next.date} · ST {state.next.appearanceTime.slice(0,5)}</span><small>{state.next.manualOverride?(state.next.confirmed?"Manual cycle override":"Unconfirmed cycle dates — no countdown"):state.next.example?"Player-confirmed example cycle — confirm it applies to your server":state.next.confirmed?"Player-confirmed schedule rule / configured cycle":"Unconfirmed cycle dates — no countdown"}</small></>:<p>No upcoming appearance in the enabled schedule. Check manual overrides and recurrence settings.</p>}
      {clock.status==="fresh"&&state.countdownSeconds!==null&&<span className="server-countdown" role="timer" aria-label="Estimated server-time countdown">{formatCountdown(state.countdownSeconds)} <small>until scheduled appearance · approximate</small></span>}
    </div>
    {state.phase==="pre-appearance"&&<p className="schedule-state">Server day reset at ST 00:00. {state.today?.name} has not reached its scheduled ST {state.today?.appearanceTime.slice(0,5)} appearance.</p>}
    {state.phase==="appearance-reached"&&<p className="schedule-state"><strong>Scheduled appearance reached — confirm in game</strong><br />{state.today?.name} · {state.today?.date} ST {state.today?.appearanceTime.slice(0,5)}. Availability and disappearance time are unverified.{state.next?" The countdown above is for the next scheduled event.":""}</p>}
    {state.phase==="unconfirmed"&&<p className="schedule-state">Today's planned cycle dates are unconfirmed; confirm the round in game.</p>}
    {state.phase==="off-week"&&<p className="schedule-state"><strong>Gorilla Legion returns in…</strong> Off-week: no Gorilla scheduled today. The countdown is to the next scheduled appearance.</p>}
    {state.phase==="unscheduled"&&<p className="schedule-state">No cycle is configured for this ST date. Gorilla Legion is not assumed available every week.</p>}
    {state.current&&state.phase!=="appearance-reached"&&<p className="muted">Last scheduled appearance: {state.current.name}, {state.current.date} ST {state.current.appearanceTime.slice(0,5)}. This is a past schedule marker, not an active Gorilla; no end time is inferred.</p>}
    <p className="muted schedule-caveat">ST timezone/UTC offset is unverified. Manual estimates can drift with entry delay, reloads, device clock changes or suspension. Resync at least every 24 hours (app policy). An undetected clock change across reloads can still affect an estimate. Dates shown are ST, not your local calendar.</p>
    {!canSave&&<p className="muted">Select a profile with a server number to save clock and cycle preferences. The schedule below is a reference example.</p>}
    {settings.migrationNotice&&<p className="schedule-state">{settings.migrationNotice}</p>}
    {error&&<p role="alert">{error}</p>}{message&&<p className="schedule-message">{message}</p>}
    {clockOpen&&<form className="server-clock-form" onSubmit={e=>{e.preventDefault();sync();}}><p>Enter the game's current full server date and 24-hour time including seconds (HH:mm:ss), then submit promptly. The old October 24 screenshot is not a current clock calibration.</p><div className="schedule-fields"><label>Current server date (ST)<input type="date" required value={stDate} onChange={e=>setStDate(e.target.value)} onInput={e=>setStDate(e.currentTarget.value)} /></label><label>Current server time (ST)<input type="text" inputMode="numeric" placeholder="HH:mm:ss" pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}" required value={stTime} onChange={e=>setStTime(e.target.value)} onInput={e=>setStTime(e.currentTarget.value)} /></label></div><button className="primary" type="submit">Synchronize estimated ST</button></form>}
    <details className="cycle-schedule"><summary>Seven-day schedule · automatic rotation</summary><p className="muted">Player-confirmed anchor: 2026-10-26. Default: seven event days, seven off days; repeat every 14 ST calendar days. Reset 00:00 · appearance 00:30. Availability and disappearance remain unverified.</p><div className="schedule-navigation"><button onClick={()=>navigate(-settings.recurrence.intervalDays)}>Previous Cycle</button><button onClick={()=>navigate(settings.recurrence.intervalDays)}>Next Cycle</button><button onClick={()=>setViewStart(null)}>Current / Next Cycle</button></div>{!settings.recurrence.enabled&&manualCycles.length>0&&<label>Saved manual cycle<select value={displayedCycle.id} onChange={e=>{const cycle=manualCycles.find(c=>c.id===e.target.value);if(cycle)setViewStart(cycle.replacesStartDate??cycle.startDate);}}>{manualCycles.map(c=><option key={c.id} value={c.id}>{c.startDate} · {c.confirmed?"Confirmed":"Unconfirmed"}</option>)}</select></label>}<label>View cycle containing ST date<input type="date" min="2000-01-01" max="2199-12-31" value={displayedStart} onInput={e=>viewDate(e.currentTarget.value)} onChange={e=>viewDate(e.target.value)} /></label><div className="schedule-cycle"><strong>{displayedStart} cycle</strong><span className="badge">{displayedCycle.source==="player-configured"?"Manual override": "Automatic recurrence"} · {!displayedCycle.enabled?"Skipped / disabled":displayedCycle.confirmed?"Confirmed schedule rule":"Unconfirmed"}</span><ol>{cycleOccurrences(displayedCycle).map(o=><li key={o.eventId}><span>{serverWeekday(o.date)} · {o.date}</span><strong>{o.name}</strong><span>{o.enabled?"ST "+o.appearanceTime.slice(0,5):"Skipped"}</span></li>)}</ol></div>{settings.cycles.length>0&&<p className="muted">Saved manual overrides: {settings.cycles.map(c=>(c.replacesStartDate??c.startDate)+" → "+c.startDate+(!c.enabled?" (skipped)":!c.confirmed?" (unconfirmed)":"")+(c.exceptions?.length?" (event exceptions)":"")).join("; ")}</p>}</details>
    <button className="text-button" disabled={!canSave} aria-expanded={configOpen} onClick={()=>setConfigOpen(!configOpen)}>Configure cycle dates / order</button>
    {configOpen&&<div className="schedule-config"><p>Settings apply only to {profile?.name}, Server {server}. Event order can change; check Current Boss in game. Manual future dates remain unconfirmed until explicitly confirmed; the default recurrence uses the player-confirmed rule.</p><details><summary>Recurring schedule settings</summary><label className="checkbox-label"><input type="checkbox" checked={recurring} onChange={e=>setRecurring(e.target.checked)} />Enable automatic recurrence</label><label>Recurrence anchor ST date<input type="date" value={anchor} onChange={e=>setAnchor(e.target.value)} /></label><label>Days between cycle starts<input type="number" min="7" max="366" value={interval} onChange={e=>setIntervalDays(Number(e.target.value))} /></label><p>The recurring order below is separate from manual cycle overrides.</p><div className="schedule-order">{recurrenceOrder.map((id,index)=><label key={index}>Recurring day {index+1} event<select value={id} onChange={e=>setRecurrenceOrder(previous=>previous.map((v,i)=>i===index?e.target.value:v))}>{USUAL_EVENT_ORDER.map(eventId=><option key={eventId} value={eventId}>{eventDisplayName(eventId)}</option>)}</select></label>)}</div><button onClick={saveRecurrence}>Save recurrence settings</button></details><label>Cycle to edit<select value={cycleId} onChange={e=>editCycle(e.target.value)}><option value="">Add a new explicit cycle</option>{settings.cycles.map(c=><option key={c.id} value={c.id}>{c.startDate} · {c.source}</option>)}</select></label><label>Cycle start server date<input type="date" value={startDate} onInput={e=>{setStartDate(e.currentTarget.value);setConfirmed(false);}} onChange={e=>{setStartDate(e.target.value);setConfirmed(false);}} /></label><label>Override original cycle start (ST)<input type="date" value={replacement} onChange={e=>setReplacement(e.target.value)} /></label><p className="muted">Leave blank to replace the cycle with the same start date. Use the original start when delaying a cycle.</p><div className="schedule-order">{order.map((id,index)=><label key={index}>Day {index+1} event<select value={id} onChange={e=>{setOrder(previous=>previous.map((v,i)=>i===index?e.target.value:v));setConfirmed(false);}}>{USUAL_EVENT_ORDER.map(eventId=><option key={eventId} value={eventId}>{eventDisplayName(eventId)}</option>)}</select></label>)}</div><details><summary>One-off event exceptions</summary><p>Explicitly adjust a date/time or skip an event. These changes apply only to this manual cycle.</p>{order.map((id,i)=>{const ex=exceptions.find(e=>e.eventId===id);const change=(patch:Partial<NonNullable<Cycle["exceptions"]>[number]>)=>setExceptions(previous=>[...previous.filter(e=>e.eventId!==id),{eventId:id,date:ex?.date??(startDate?addServerDays(startDate,i):""),time:ex?.time??"00:30:00",skip:ex?.skip??false,...patch}]);return <div className="schedule-fields" key={i}><label>{eventDisplayName(id)} date<input type="date" value={ex?.date??""} onChange={e=>change({date:e.target.value})} /></label><label>{eventDisplayName(id)} ST time<input placeholder="00:30:00" value={ex?.time??""} onChange={e=>change({time:e.target.value})} /></label><label><input type="checkbox" checked={ex?.skip??false} onChange={e=>change({skip:e.target.checked})} />Skip {eventDisplayName(id)}</label></div>;})}<button onClick={()=>setExceptions([])}>Clear event exceptions</button></details><label className="checkbox-label"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />Include this cycle in the schedule</label><label className="checkbox-label"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />I have confirmed these cycle dates and order for this server</label><button className="primary" onClick={saveCycle}>Save cycle settings</button></div>}
  </section>;
}
