// @vitest-environment jsdom
import { afterEach,expect,it } from "vitest";
import { cleanup,render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServerSchedule } from "./ServerSchedule";
import { defaultSettings,loadScheduleSettings,SCHEDULE_KEY } from "../server-schedule";
import { systemProfile,systemStorage } from "../test/system-fixtures";
afterEach(cleanup);
it.each(["update","keep"])("requires confirmation for updates and remembers %s after remount",async decision=>{
  const storage=systemStorage(),profile=systemProfile();const settings=defaultSettings(profile.id,profile.serverNumber!);
  settings.recurrence.order=["space","wise","cyber","primal","armed","treasure","warlord"];
  storage.setItem(SCHEDULE_KEY,JSON.stringify({version:3,entries:[settings]}));const raw=storage.getItem(SCHEDULE_KEY);
  const props={profile,storage,now:()=>Date.parse("2026-11-02T12:00:00Z"),monotonic:()=>0};
  const user=userEvent.setup(),view=render(<ServerSchedule {...props} />);
  expect(screen.getByText(/Saved: Wednesday Cyber Gorilla; Thursday Primal Gorilla/)).toBeTruthy();
  if(decision==="update"){
    await user.click(screen.getByRole("button",{name:"Update to current Gorilla order"}));expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
    await user.click(screen.getByRole("button",{name:"Cancel"}));expect(storage.getItem(SCHEDULE_KEY)).toBe(raw);
    await user.click(screen.getByRole("button",{name:"Update to current Gorilla order"}));await user.click(screen.getByRole("button",{name:"Confirm order update"}));
  }else await user.click(screen.getByRole("button",{name:"Keep my saved order"}));
  expect(screen.queryByRole("button",{name:"Update to current Gorilla order"})).toBeNull();
  expect(loadScheduleSettings(storage,profile.id,profile.serverNumber!).recurrence.order[2]).toBe(decision==="update"?"primal":"cyber");
  view.unmount();render(<ServerSchedule {...props} />);expect(screen.queryByRole("button",{name:"Update to current Gorilla order"})).toBeNull();
});
