// @vitest-environment jsdom
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,render,screen,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {TroopRatioTesting} from "./TroopRatioTesting";
import {eventData} from "../data/events";
import {systemProfile,systemStorage} from "../test/system-fixtures";
import {emptyBattle,saveBattle,type Battle} from "../battles";
import {generateEventFormations} from "../event-engine";
import {classifiedFixture} from "../test/fixtures";
import {positions} from "../engine";
afterEach(cleanup);
it("shows comparable evidence and Best Observed, excluding other profiles and servers",async()=>{
 const profile=systemProfile(),storage=systemStorage(),event=eventData.events[0],user=userEvent.setup();
 const f=generateEventFormations({profile,event,catalog:classifiedFixture})[0];
 function record(id:string,damage:number):Battle{return {...emptyBattle(id,profile.serverNumber!,event.id),profileId:profile.id,date:"2026-10-24",damage,attackKind:"individual",attackCount:1,formation:f.teams.map(t=>Object.fromEntries(positions.map(p=>[p,t.heroes[p].id]))) as Battle["formation"],ratios:{mode:"Shared",ratio:{shield:0,bomber:20,shooter:80}},progressionSnapshot:profile,testConditions:{group:"A",setup:"Known same boss, troop tier and upgrades",confirmed:true}};}
 const a=record("a",100),b=record("b",125);b.ratios={mode:"Shared",ratio:{shield:0,bomber:4,shooter:96}};saveBattle(storage,a);saveBattle(storage,b);saveBattle(storage,{...record("other",99999),server:260,profileId:null,progressionSnapshot:null});
 render(<TroopRatioTesting profile={profile} event={event} current={{mode:"Shared",ratio:event.startingRatio}} snapshot={{profile,formations:[f]}} storage={storage} apply={vi.fn()} />);
 await user.click(screen.getByText("Compare recorded ratio tests / Best Observed"));
 expect(within(screen.getByLabelText("Reference battle")).getAllByRole("option")).toHaveLength(3);
 await user.selectOptions(screen.getByLabelText("Reference battle"),"a");await user.selectOptions(screen.getByLabelText("Comparison battle"),"b");
 expect(screen.getByText("Observed difference: 25 (25.00%)")).toBeTruthy();expect(screen.getByRole("heading",{name:"Best Observed"})).toBeTruthy();
 expect(screen.getByText(/125 reported damage · 1 samples at this ratio · 2 comparable records/)).toBeTruthy();
 expect(screen.getByText(/single sample cannot establish/)).toBeTruthy();
});
it("keeps the historical 260 reference read-only and never inserts it into a 248 profile",async()=>{
 const profile=systemProfile();profile.serverNumber=248;const storage=systemStorage(),before=structuredClone(profile),user=userEvent.setup();
 render(<TroopRatioTesting profile={profile} event={eventData.events[0]} current={{mode:"Shared",ratio:eventData.events[0].startingRatio}} snapshot={null} storage={storage} apply={()=>{}} />);
 await user.click(screen.getByText("Historical reference — Server 260 only"));expect(screen.getByText(/559,430,622 reported damage/)).toBeTruthy();
 expect(storage.getItem("gorillalab.battles.v1")).toBeNull();expect(profile).toEqual(before);
});

it("edits one independent team without changing the other two after switching from Shared",async()=>{
 const profile=systemProfile(),event=eventData.events[0],apply=vi.fn(),user=userEvent.setup();const f=generateEventFormations({profile,event,catalog:classifiedFixture})[0];
 render(<TroopRatioTesting profile={profile} event={event} current={{mode:"Shared",ratio:event.startingRatio}} snapshot={{profile,formations:[f]}} storage={systemStorage()} apply={apply} />);
 await user.click(screen.getByText("Create or save a ratio candidate"));await user.selectOptions(screen.getByLabelText("Candidate ratio mode"),"Independent");
 const b=screen.getByLabelText("Candidate Team 2 bomber percentage"),s=screen.getByLabelText("Candidate Team 2 shooter percentage");
 await user.clear(b);await user.type(b,"9");await user.clear(s);await user.type(s,"91");await user.click(screen.getByRole("button",{name:"Apply edited percentages"}));
 expect(apply).toHaveBeenCalledWith({mode:"Independent",ratios:[{shield:0,bomber:20,shooter:80},{shield:0,bomber:9,shooter:91},{shield:0,bomber:20,shooter:80}]},0);
});
