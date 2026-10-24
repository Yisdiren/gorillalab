// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {act,cleanup,fireEvent,render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {ServerSchedule} from "./ServerSchedule";
import {CLOCK_MAX_AGE_MS,SCHEDULE_KEY,loadScheduleSettings,synchronizeServerClock,updateScheduleSettings} from "../server-schedule";
import {systemProfile,systemStorage} from "../test/system-fixtures";
import {saveProfile,STORAGE_KEY} from "../profiles";
const client=Date.parse("2026-10-24T12:00:00Z");
afterEach(()=>{cleanup();vi.useRealTimers();});
it("shows the example without a numeric countdown until the server clock is set",()=>{
 const storage=systemStorage();render(<ServerSchedule profile={systemProfile()} storage={storage} now={()=>client} monotonic={()=>0} />);
 expect(screen.queryByRole("timer")).toBeNull();expect(screen.getByRole("button",{name:"Set server clock"})).toBeTruthy();
 expect(screen.getByText(/Player-confirmed schedule rule/)).toBeTruthy();expect(storage.getItem(SCHEDULE_KEY)).toBeNull();
 expect(screen.queryByText(/^Live$|^Active$|^Ended$/)).toBeNull();
});
it("synchronizes explicitly, crosses the appearance threshold and keeps profile/history data unchanged",()=>{
 vi.useFakeTimers();let wall=client,mono=0;const storage=systemStorage(),profile=systemProfile();saveProfile(storage,profile);const before=storage.getItem(STORAGE_KEY);storage.setItem("gorillalab.battles.v1","retained");
 render(<ServerSchedule profile={profile} storage={storage} now={()=>wall} monotonic={()=>mono} />);
 fireEvent.click(screen.getByRole("button",{name:"Set server clock"}));
 fireEvent.input(screen.getByLabelText("Current server date (ST)"),{target:{value:"2026-10-26"}});
 fireEvent.input(screen.getByLabelText("Current server time (ST)"),{target:{value:"00:29:59"}});
 fireEvent.click(screen.getByRole("button",{name:"Synchronize estimated ST"}));
 expect(screen.getByRole("timer").textContent).toContain("00:00:01");expect(screen.getByText(/Server day reset at ST 00:00/)).toBeTruthy();
 act(()=>{wall+=1000;mono+=1000;vi.advanceTimersByTime(1000);});
 expect(screen.getByText("Scheduled appearance reached — confirm in game")).toBeTruthy();expect(screen.getByRole("timer").textContent).toContain("1d 00:00:00");
 expect(loadScheduleSettings(storage,profile.id,profile.serverNumber!).calibration?.serverDateTime).toBe("2026-10-26T00:29:59");
 expect(storage.getItem(STORAGE_KEY)).toBe(before);expect(storage.getItem("gorillalab.battles.v1")).toBe("retained");
 fireEvent.click(screen.getByRole("button",{name:"Resync server clock"}));expect((screen.getByLabelText("Current server date (ST)") as HTMLInputElement).value).toBe("");expect((screen.getByLabelText("Current server time (ST)") as HTMLInputElement).value).toBe("");
});
it("persists clock-jump invalidation across remounts and hides stale countdowns",()=>{
 vi.useFakeTimers();let wall=client,mono=0;const storage=systemStorage(),profile=systemProfile();
 updateScheduleSettings(storage,profile.id,profile.serverNumber!,s=>({...s,calibration:synchronizeServerClock("2026-10-26T00:20:00",client)}));
 const now=()=>wall,monotonic=()=>mono;const view=render(<ServerSchedule profile={profile} storage={storage} now={now} monotonic={monotonic} />);
 expect(screen.getByRole("timer")).toBeTruthy();act(()=>{wall+=60_000;mono+=1000;vi.advanceTimersByTime(1000);});
 expect(screen.queryByRole("timer")).toBeNull();expect(loadScheduleSettings(storage,profile.id,profile.serverNumber!).calibration?.invalidated).toBe(true);
 view.unmount();render(<ServerSchedule profile={profile} storage={storage} now={now} monotonic={monotonic} />);expect(screen.queryByRole("timer")).toBeNull();
 cleanup();const stale=systemStorage();updateScheduleSettings(stale,profile.id,profile.serverNumber!,s=>({...s,calibration:synchronizeServerClock("2026-10-26T00:20:00",client)}));render(<ServerSchedule profile={profile} storage={stale} now={()=>client+CLOCK_MAX_AGE_MS+1} monotonic={()=>0} />);expect(screen.queryByRole("timer")).toBeNull();expect(screen.getByText(/Calibration is older than 24 hours/)).toBeTruthy();
});
it("resumes a fresh saved clock after reload and isolates a changed profile/server",()=>{
 const storage=systemStorage(),profile=systemProfile();updateScheduleSettings(storage,profile.id,profile.serverNumber!,s=>({...s,calibration:synchronizeServerClock("2026-10-26T00:29:30",client)}));
 const view=render(<ServerSchedule key="first" profile={profile} storage={storage} now={()=>client+10_000} monotonic={()=>0} />);
 expect(screen.getByRole("timer").textContent).toContain("00:00:20");
 view.rerender(<ServerSchedule key="second" profile={{...profile,serverNumber:260}} storage={storage} now={()=>client+10_000} monotonic={()=>0} />);expect(screen.queryByRole("timer")).toBeNull();
 expect(loadScheduleSettings(storage,profile.id,profile.serverNumber!).calibration).not.toBeNull();
 view.rerender(<ServerSchedule key="third" profile={{...profile,id:"other"}} storage={storage} now={()=>client+10_000} monotonic={()=>0} />);expect(screen.queryByRole("timer")).toBeNull();
});
it("requires explicit confirmation of new cycles and supports corrected order and inactive settings",async()=>{
 const storage=systemStorage(),profile=systemProfile(),user=userEvent.setup();
 updateScheduleSettings(storage,profile.id,profile.serverNumber!,s=>({...s,recurrence:{...s.recurrence,enabled:false},calibration:synchronizeServerClock("2026-11-08T12:00:00",client)}));
 render(<ServerSchedule profile={profile} storage={storage} now={()=>client} monotonic={()=>0} />);expect(screen.queryByRole("timer")).toBeNull();
 await user.click(screen.getByRole("button",{name:"Configure cycle dates / order"}));
 fireEvent.input(screen.getByLabelText("Cycle start server date"),{target:{value:"2026-11-09"}});
 await user.selectOptions(screen.getByLabelText("Day 3 event"),"primal");await user.selectOptions(screen.getByLabelText("Day 4 event"),"cyber");
 await user.click(screen.getByRole("button",{name:"Save cycle settings"}));expect(screen.queryByRole("timer")).toBeNull();expect(screen.getByText(/Unconfirmed cycle dates — no countdown/)).toBeTruthy();
 await user.click(screen.getByRole("checkbox",{name:"I have confirmed these cycle dates and order for this server"}));await user.click(screen.getByRole("button",{name:"Save cycle settings"}));
 expect(screen.getByRole("timer").textContent).toContain("12:30:00");
 const saved=loadScheduleSettings(storage,profile.id,profile.serverNumber!).cycles.find(c=>c.startDate==="2026-11-09")!;expect(saved.order[2]).toBe("primal");
 await user.click(screen.getByRole("checkbox",{name:"Include this cycle in the schedule"}));await user.click(screen.getByRole("button",{name:"Save cycle settings"}));expect(screen.queryByRole("timer")).toBeNull();
});
it("shows the exact seven-day ST schedule and never derives a UTC offset from the screenshot",async()=>{
 const user=userEvent.setup();render(<ServerSchedule profile={systemProfile()} storage={systemStorage()} now={()=>client} monotonic={()=>0} />);
 await user.click(screen.getByText("Seven-day schedule · automatic rotation"));
 const list=screen.getByRole("list");expect(within(list).getAllByRole("listitem").map(n=>n.textContent)).toEqual([
 "Monday · 2026-10-26Space GorillaST 00:30","Tuesday · 2026-10-27Wise GorillaST 00:30","Wednesday · 2026-10-28Cyber GorillaST 00:30","Thursday · 2026-10-29Primal GorillaST 00:30","Friday · 2026-10-30Armed GorillaST 00:30","Saturday · 2026-10-31Treasure GorillaST 00:30","Sunday · 2026-11-01Gorilla WarlordST 00:30"]);
 expect(screen.getByText(/ST timezone\/UTC offset is unverified/)).toBeTruthy();expect(screen.queryByRole("timer")).toBeNull();
});
it("does not overwrite malformed settings and disables persistence without a profile/server",async()=>{
 const storage=systemStorage();storage.setItem(SCHEDULE_KEY,'{"version":99}');render(<ServerSchedule profile={systemProfile()} storage={storage} now={()=>client} monotonic={()=>0} />);
 expect(screen.getByRole("alert").textContent).toContain("not been overwritten");expect(storage.getItem(SCHEDULE_KEY)).toBe('{"version":99}');
 cleanup();render(<ServerSchedule profile={null} storage={systemStorage()} now={()=>client} monotonic={()=>0} />);expect((screen.getByRole("button",{name:"Set server clock"}) as HTMLButtonElement).disabled).toBe(true);
});
it("navigates recurring cycles without changing stored settings and shows the off-week safely",async()=>{
 const storage=systemStorage(),profile=systemProfile(),user=userEvent.setup();updateScheduleSettings(storage,profile.id,profile.serverNumber!,s=>({...s,calibration:synchronizeServerClock("2026-11-04T12:00:00",client)}));
 const before=storage.getItem(SCHEDULE_KEY);render(<ServerSchedule profile={profile} storage={storage} now={()=>client} monotonic={()=>0} />);
 expect(screen.getByText("Gorilla Legion returns in…")).toBeTruthy();expect(screen.queryByText("Scheduled appearance reached — confirm in game")).toBeNull();expect(screen.getByRole("timer").textContent).toContain("4d 12:30:00");
 await user.click(screen.getByText("Seven-day schedule · automatic rotation"));expect(screen.getByText("2026-11-09 cycle")).toBeTruthy();
 await user.click(screen.getByRole("button",{name:"Next Cycle"}));expect(screen.getByText("2026-11-23 cycle")).toBeTruthy();
 await user.click(screen.getByRole("button",{name:"Previous Cycle"}));expect(screen.getByText("2026-11-09 cycle")).toBeTruthy();
 fireEvent.change(screen.getByLabelText("View cycle containing ST date"),{target:{value:"2028-02-29"}});expect(screen.getByText("2028-02-28 cycle")).toBeTruthy();expect(storage.getItem(SCHEDULE_KEY)).toBe(before);
});
it("saves profile-scoped recurring cadence only on explicit action",async()=>{
 const storage=systemStorage(),profile=systemProfile(),user=userEvent.setup();render(<ServerSchedule profile={profile} storage={storage} now={()=>client} monotonic={()=>0} />);
 await user.click(screen.getByRole("button",{name:"Configure cycle dates / order"}));await user.click(screen.getByText("Recurring schedule settings"));
 fireEvent.change(screen.getByLabelText("Days between cycle starts"),{target:{value:"21"}});expect(storage.getItem(SCHEDULE_KEY)).toBeNull();await user.click(screen.getByRole("button",{name:"Save recurrence settings"}));
 expect(loadScheduleSettings(storage,profile.id,profile.serverNumber!).recurrence.intervalDays).toBe(21);expect(loadScheduleSettings(storage,"other",260).recurrence.intervalDays).toBe(14);
});
it("lets players save a delayed event exception and displays its actual ST time",async()=>{
 const storage=systemStorage(),profile=systemProfile(),user=userEvent.setup();updateScheduleSettings(storage,profile.id,profile.serverNumber!,s=>({...s,calibration:synchronizeServerClock("2026-11-09T00:40:00",client)}));
 render(<ServerSchedule profile={profile} storage={storage} now={()=>client} monotonic={()=>0} />);await user.click(screen.getByRole("button",{name:"Configure cycle dates / order"}));
 fireEvent.input(screen.getByLabelText("Cycle start server date"),{target:{value:"2026-11-09"}});await user.click(screen.getByText("One-off event exceptions"));fireEvent.change(screen.getByLabelText("Space Gorilla ST time"),{target:{value:"01:00:00"}});
 await user.click(screen.getByRole("checkbox",{name:"I have confirmed these cycle dates and order for this server"}));await user.click(screen.getByRole("button",{name:"Save cycle settings"}));
 expect(screen.getByRole("timer").textContent).toContain("00:20:00");expect(screen.getByText(/scheduled ST 01:00 appearance/)).toBeTruthy();expect(loadScheduleSettings(storage,profile.id,profile.serverNumber!).cycles[0].exceptions?.[0].time).toBe("01:00:00");expect(screen.getByText(/Manual cycle override/)).toBeTruthy();
});
it("keeps manual-cycle order separate when saving recurrence preferences",async()=>{
 const storage=systemStorage(),profile=systemProfile(),user=userEvent.setup();render(<ServerSchedule profile={profile} storage={storage} now={()=>client} monotonic={()=>0} />);
 await user.click(screen.getByRole("button",{name:"Configure cycle dates / order"}));await user.selectOptions(screen.getByLabelText("Day 3 event"),"primal");await user.selectOptions(screen.getByLabelText("Day 4 event"),"cyber");
 await user.click(screen.getByText("Recurring schedule settings"));await user.click(screen.getByRole("button",{name:"Save recurrence settings"}));expect(loadScheduleSettings(storage,profile.id,profile.serverNumber!).recurrence.order[2]).toBe("cyber");
 await user.selectOptions(screen.getByLabelText("Recurring day 3 event"),"primal");await user.selectOptions(screen.getByLabelText("Recurring day 4 event"),"cyber");await user.click(screen.getByRole("button",{name:"Save recurrence settings"}));expect(loadScheduleSettings(storage,profile.id,profile.serverNumber!).recurrence.order[2]).toBe("primal");
});
it("does not crash the cycle view when a supported date belongs to an adjacent-year cycle",async()=>{
 const user=userEvent.setup();render(<ServerSchedule profile={systemProfile()} storage={systemStorage()} now={()=>client} monotonic={()=>0} />);await user.click(screen.getByText("Seven-day schedule · automatic rotation"));
 fireEvent.input(screen.getByLabelText("View cycle containing ST date"),{target:{value:"2000-01-01"}});expect(screen.getByRole("list").children.length).toBe(7);
 fireEvent.input(screen.getByLabelText("View cycle containing ST date"),{target:{value:"2199-12-31"}});expect(screen.getByRole("list").children.length).toBe(7);
});
it("shows and navigates migrated off-cadence manual cycles when recurrence is disabled",async()=>{
 const storage=systemStorage(),profile=systemProfile(),user=userEvent.setup();const base={order:["space","wise","cyber","primal","armed","treasure","warlord"],enabled:true,confirmed:true,source:"player-configured"};
 storage.setItem(SCHEDULE_KEY,JSON.stringify({version:1,entries:[{profileId:profile.id,server:profile.serverNumber,calibration:null,cycles:[{...base,id:"one",startDate:"2026-10-27"},{...base,id:"two",startDate:"2026-11-24"}]}]}));render(<ServerSchedule profile={profile} storage={storage} now={()=>client} monotonic={()=>0} />);
 expect(screen.getByText(/Legacy manual dates overlap/)).toBeTruthy();await user.click(screen.getByText("Seven-day schedule · automatic rotation"));expect(screen.getByText("2026-10-27 cycle")).toBeTruthy();await user.click(screen.getByRole("button",{name:"Next Cycle"}));expect(screen.getByText("2026-11-24 cycle")).toBeTruthy();await user.click(screen.getByRole("button",{name:"Previous Cycle"}));expect(screen.getByText("2026-10-27 cycle")).toBeTruthy();
});
