import { useState } from "react";
import type { Storage } from "../profiles";
import { addServerDays, needsOrderReview, resolveOrderReview, serverWeekday, type ScheduleSettings } from "../server-schedule";

export function ScheduleOrderReview({settings,storage,onSaved}:{settings:ScheduleSettings;storage:Storage;onSaved:(next:ScheduleSettings)=>void}) {
  const [reviewing,setReviewing]=useState(false),[error,setError]=useState("");
  if(!needsOrderReview(settings))return null;
  const third=serverWeekday(addServerDays(settings.recurrence.anchorDate,2));
  const fourth=serverWeekday(addServerDays(settings.recurrence.anchorDate,3));
  function resolve(decision:"update"|"keep") {
    try {onSaved(resolveOrderReview(storage,settings.profileId,settings.server,decision,settings.recurrence));setReviewing(false);setError("");}
    catch(e){setError(String(e));}
  }
  return <div className="schedule-state" aria-label="Saved Gorilla order review">
    <p>Your saved recurring order may be intentional. The current order was confirmed on Servers 248 and 10004; it is not a permanent game-wide rule.</p>
    <p>Saved: {third} Cyber Gorilla; {fourth} Primal Gorilla.<br />Proposed: {third} Primal Gorilla; {fourth} Cyber Gorilla.</p>
    <p>Only recurring order changes. Your anchor, interval, enabled setting, manual cycles, exceptions and historical records stay unchanged. Manual cycle overrides still take precedence.</p>
    {!reviewing?<div className="button-row"><button type="button" className="secondary" onClick={()=>setReviewing(true)}>Update to current Gorilla order</button><button type="button" className="text-button" onClick={()=>resolve("keep")}>Keep my saved order</button></div>
      :<div role="group" aria-label="Confirm Gorilla order update"><p>Apply this recurring order to this profile and Server {settings.server}?</p><div className="button-row"><button type="button" className="primary" onClick={()=>resolve("update")}>Confirm order update</button><button type="button" className="secondary" onClick={()=>setReviewing(false)}>Cancel</button></div></div>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
