// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { heroCatalog } from "./data/catalog";
import { eventData } from "./data/events";
import { classifiedFixture } from "./test/fixtures";
import { createProfile, loadProfiles, STORAGE_KEY, type PlayerProfile } from "./profiles";

function memory(profiles: PlayerProfile[] = []) {
  const entries = new Map([[STORAGE_KEY, JSON.stringify({ version: 2, profiles })]]);
  return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } };
}
function completeProfile() {
  const p = createProfile("ui-fixture", "Test Commander"); p.serverNumber = 10004; p.currentSeason = 2;
  p.ownedHeroes = classifiedFixture.map((h, i) => ({ heroId: h.id, stars: i, skillLevels: {}, equipment: [] }));
  p.classOverrides = Object.fromEntries(classifiedFixture.map(h => [h.id, { value: h.class!.value, verification: "unverified" as const }]));
  p.seasonOverrides = Object.fromEntries(classifiedFixture.map(h => [h.id, { from: 1, verification: "unverified" as const }]));
  p.ownedRobots = [{ robotId: "Synthetic robot", upgrades: {} }];
  return p;
}
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("hero-catalog") ? { version: 1, heroes: heroCatalog } : eventData })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
async function ready() { await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2)); }
async function fill(name: string, value: number | string) {
  const user = userEvent.setup(); const input = screen.getByRole("spinbutton", { name });
  await user.clear(input); await user.type(input, String(value));
}

it("shows seven event choices, separate Sunday bonuses, and editable ratio modes", async () => {
  const user = userEvent.setup(); render(<App storage={memory()} />); await ready();
  const choices = within(screen.getByRole("group", { name: "Gorilla event" })).getAllByRole("button");
  expect(choices).toHaveLength(7);
  await user.click(screen.getByRole("button", { name: "Sunday Gorilla Warlord" }));
  expect(screen.getAllByText("Normal strength")).toHaveLength(6);
  await user.click(screen.getByRole("button", { name: /Use starting ratio/ }));
  expect((screen.getByRole("spinbutton", { name: "Shared Bomber percentage" }) as HTMLInputElement).value).toBe("10");
  await user.click(screen.getByRole("button", { name: "Independent" }));
  await fill("Team 2 Bomber percentage", 25);
  expect((screen.getByRole("spinbutton", { name: "Team 1 Bomber percentage" }) as HTMLInputElement).value).toBe("10");
  expect((screen.getByRole("spinbutton", { name: "Team 2 Bomber percentage" }) as HTMLInputElement).value).toBe("25");
});

it("creates and saves multiple isolated profiles for any server", async () => {
  const storage = memory(); const user = userEvent.setup(); render(<App storage={storage} />); await ready();
  await user.click(screen.getByRole("button", { name: /Create player profile/ }));
  await user.clear(screen.getByLabelText("Profile name")); await user.type(screen.getByLabelText("Profile name"), "Commander One");
  await fill("Server number", 10004); await fill("Current season", 4);
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  await user.click(screen.getByRole("button", { name: /New profile/ }));
  await user.clear(screen.getByLabelText("Profile name")); await user.type(screen.getByLabelText("Profile name"), "Commander Two");
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  expect(loadProfiles(storage).profiles.map(p => p.name)).toEqual(["Commander One", "Commander Two"]);
  expect(loadProfiles(storage).profiles[0].serverNumber).toBe(10004);
  expect(loadProfiles(storage).profiles[1].ownedHeroes).toEqual([]);
  await user.click(screen.getByRole("button", { name: /^Commander One/ }));
  expect((screen.getByLabelText("Profile name") as HTMLInputElement).value).toBe("Commander One");
});

it("searches ownership, edits progression and eligibility, and saves without changing the catalog", async () => {
  const p = createProfile("editing", "Editor"); p.currentSeason = 2;
  const storage = memory([p]); const user = userEvent.setup(); render(<App storage={storage} />); await ready();
  await user.click(screen.getByRole("button", { name: /Heroes & progression/ }));
  await user.type(screen.getByRole("searchbox", { name: "Search heroes" }), "Ada");
  expect(screen.getByRole("img", { name: "Ada portrait" }).getAttribute("src")).toBe("/portraits/ada.png");
  await user.click(screen.getByRole("checkbox", { name: "Own Ada" }));
  await user.click(screen.getByText("Edit progression & eligibility"));
  await fill("Stars", 3);
  await user.selectOptions(screen.getByLabelText(/Class override/), "Shooter");
  await fill("Available from season · unverified", 1);
  await user.type(screen.getByLabelText("Skill name"), "Player skill entry");
  await user.click(screen.getByRole("button", { name: "Add skill" }));
  await fill("Player skill entry", 4);
  await user.click(screen.getByRole("button", { name: /Add equipment/ }));
  await user.type(screen.getByLabelText("Equipment name"), "Player equipment entry"); await fill("Level", 2);
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  const saved = loadProfiles(storage).profiles[0];
  expect(saved.ownedHeroes).toEqual([{ heroId: "Ada", stars: 3, skillLevels: { "Player skill entry": 4 }, equipment: [{ name: "Player equipment entry", level: 2 }] }]);
  expect(saved.classOverrides?.Ada.value).toBe("Shooter");
  expect(heroCatalog.find(h => h.id === "Ada")!.class).toBeNull();
  await user.selectOptions(screen.getByLabelText("Ownership & eligibility"), "eligible");
  expect(screen.getByRole("heading", { name: "Ada" })).toBeTruthy();
});

it("renders one recommendation and expandable real engine alternatives with all three teams", async () => {
  const storage = memory([completeProfile()]); const user = userEvent.setup(); render(<App storage={storage} />); await ready();
  await fill("Shared Shieldbearer percentage", 1); await fill("Shared Bomber percentage", 9); await fill("Shared Shooter percentage", 90);
  await user.click(screen.getByRole("button", { name: "Wednesday Cyber Gorilla" }));
  await user.click(within(screen.getByRole("group", { name: "Team 1 robot" })).getByRole("button", { name: /Synthetic robot/ }));
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  const first = await screen.findByRole("article", { name: "Formation 1" });
  expect(screen.getAllByRole("article", { name: /^Formation [1-5]$/ })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Show 4 Alternative Formations" }));
  expect(screen.getAllByRole("article", { name: /^Formation [1-5]$/ })).toHaveLength(5);
  expect(within(first).getAllByRole("region", { name: /Formation 1 team/ })).toHaveLength(3);
  expect(within(first).getByText("0 ★")).toBeTruthy();
  expect(within(first).getAllByRole("img")).toHaveLength(9);
  expect(within(first).getByRole("img", { name: "Ada portrait" }).getAttribute("src")).toBe("/portraits/ada.png");
  expect(within(first).getByText(/Robot: Synthetic robot/)).toBeTruthy();
  expect(within(first).getAllByText("heuristic points")).toHaveLength(1);
  await user.click(within(first).getByText("Score explanation & data warnings"));
  expect(within(first).getByText(/Community-tier ordinal preferences are enabled/)).toBeTruthy();
  expect(screen.getByText(/Missing data does not mean a hero is weak/)).toBeTruthy();
  await fill("Shared Bomber percentage", 10);
  expect(screen.queryByRole("article", { name: "Formation 1" })).toBeNull();
});

it("shows actionable validation errors instead of invalid formations", async () => {
  const user = userEvent.setup(); render(<App storage={memory([completeProfile()])} />); await ready();
  await fill("Shared Shieldbearer percentage", 15);
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("alert").textContent).toContain("100");
  expect(screen.queryByRole("article", { name: "Formation 1" })).toBeNull();
});

it("persists robot assignments and clears them when a robot is removed", async () => {
  const p = completeProfile(); p.teamRobotIds = ["Synthetic robot", null, null];
  const storage = memory([p]); const user = userEvent.setup(); render(<App storage={storage} />); await ready();
  await user.click(screen.getByRole("button", { name: "Wednesday Cyber Gorilla" }));
  await user.click(screen.getByRole("button", { name: "Player profiles" }));
  await user.click(screen.getByText((_, element) => element?.tagName === "SUMMARY" && !!element.textContent?.startsWith("Synthetic robot")));
  await user.click(screen.getByRole("button", { name: "Remove Synthetic robot" }));
  await user.click(screen.getByRole("button", { name: "Save profile" }));
  expect(loadProfiles(storage).profiles[0].teamRobotIds).toEqual([null, null, null]);
  expect(loadProfiles(storage).profiles[0].ownedRobots).toEqual([]);
});




it("hands the chosen non-Space formation to history with its matching snapshot and preserves profiles", async () => {
  const profile = completeProfile(), storage = memory([profile]), user = userEvent.setup();
  const before = JSON.stringify(loadProfiles(storage));
  render(<App storage={storage} />); await ready();
  await user.click(screen.getByRole("button", { name: "Tuesday Wise Gorilla" }));
  await fill("Shared Shieldbearer percentage", 1); await fill("Shared Bomber percentage", 9); await fill("Shared Shooter percentage", 90);
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  await screen.findByRole("article", { name: "Formation 1" });
  await user.click(screen.getByRole("button", { name: "Show 4 Alternative Formations" }));
  const selected = await screen.findByRole("article", { name: "Formation 4" });
  const names = [...selected.querySelectorAll(".hero-position strong")].map(element => element.textContent);
  await user.click(within(selected).getByRole("button", { name: "Log an attack with this setup" }));
  expect((screen.getByLabelText("Gorilla type") as HTMLSelectElement).value).toBe("wise");
  expect((screen.getByLabelText("Generated formation snapshot") as HTMLSelectElement).value).toBe("3");
  expect((screen.getByLabelText("Attack aggregation") as HTMLSelectElement).value).toBe("individual");
  expect((screen.getByLabelText("Attach generated individual formation, troops, robots and progression snapshot") as HTMLInputElement).checked).toBe(true);
  await user.type(screen.getByLabelText("Reported damage"), "12345");
  await user.click(screen.getByRole("button", { name: "Save battle record" }));
  const { loadBattles } = await import("./battles"); const record = loadBattles(storage)[0];
  expect(record.eventId).toBe("wise");
  expect(record.formation?.flatMap(team => [team.Left, team.Middle, team.Right])).toEqual(names);
  expect(record.progressionSnapshot).toEqual(profile);
  expect(record.troopCounts).toBeNull();
  expect(JSON.stringify(loadProfiles(storage))).toBe(before);
});

it("imports a corrected TXT roster from Player Profiles with explicit star confirmation and profile isolation", async () => {
  const one = createProfile("txt-one", "TXT One"), two = createProfile("txt-two", "TXT Two");
  one.ownedHeroes = [{ heroId: "Ada", stars: 2, skillLevels: { war: 3 }, equipment: [{ name: "Kit", level: 1 }] }];
  one.ownedRobots = [{ robotId: "Owned", upgrades: { core: 2 } }];
  const storage = memory([one, two]); const user = userEvent.setup(); render(<App storage={storage} />); await ready();
  await user.click(screen.getByRole("button", { name: "Manage profile" }));
  const file = new File(["Ada 4 stars\nAdah ★5\nDurga ★5"], "roster.txt", { type: "text/plain" });
  await user.upload(screen.getByLabelText("Roster TXT file"), file);
  await screen.findByRole("heading", { name: "Import preview" });
  const button = screen.getByRole("button", { name: "Import roster into TXT One" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  expect(loadProfiles(storage).profiles[0]).toEqual(one);
  await user.click(screen.getByRole("checkbox", { name: "Skip line 2" }));
  await user.click(screen.getByRole("checkbox", { name: /I confirm overwriting existing star levels/ }));
  await user.click(button);
  await screen.findByText("Roster imported and saved for TXT One.");
  const saved = loadProfiles(storage).profiles;
  expect(saved[0].ownedHeroes.map(h => [h.heroId, h.stars])).toEqual([["Ada", 4], ["Durga", 5]]);
  expect(saved[0].ownedHeroes[0].skillLevels).toEqual({ war: 3 }); expect(saved[0].ownedHeroes[0].equipment).toEqual(one.ownedHeroes[0].equipment);
  expect(saved[0].ownedRobots).toEqual(one.ownedRobots); expect(saved[1]).toEqual(two);
});

it("previews corrections and requires removal confirmation for Replace without resetting retained progression", async () => {
  const p = createProfile("replace", "Replace Test");
  p.ownedHeroes = [{ heroId: "Ada", stars: 3, skillLevels: { skill: 2 }, equipment: [] }, { heroId: "Mia", stars: 4, skillLevels: {}, equipment: [] }];
  const storage = memory([p]); const user = userEvent.setup(); render(<App storage={storage} />); await ready();
  await user.click(screen.getByRole("button", { name: "Manage profile" }));
  await user.upload(screen.getByLabelText("Roster TXT file"), new File(["Adah ★9"], "bad.txt", { type: "text/plain" }));
  await screen.findByRole("heading", { name: "Import preview" });
  await user.selectOptions(screen.getByLabelText("Hero match · line 1"), "Ada");
  const stars = screen.getByLabelText("Stars · line 1"); await user.clear(stars); await user.type(stars, "3");
  await user.selectOptions(screen.getByLabelText("Roster import mode"), "replace");
  const button = screen.getByRole("button", { name: "Import roster into Replace Test" });
  expect((button as HTMLButtonElement).disabled).toBe(true);
  await user.click(screen.getByRole("checkbox", { name: /I confirm removing 1 owned heroes/ }));
  await user.click(button);
  await screen.findByText("Roster imported and saved for Replace Test.");
  expect(loadProfiles(storage).profiles[0].ownedHeroes).toEqual([p.ownedHeroes[0]]);
});

it("shows plural roster counts and catalog gaps separately without importing automatically", async () => {
  const { suppliedRosterExcerpt } = await import("./test/roster-excerpt");
  const p = createProfile("plural", "Plural Test"); const storage = memory([p]);
  const user = userEvent.setup(); render(<App storage={storage} />); await ready();
  await user.click(screen.getByRole("button", { name: "Manage profile" }));
  await user.upload(screen.getByLabelText("Roster TXT file"), new File(["\uFEFF" + suppliedRosterExcerpt], "roster.txt", { type: "text/plain;charset=utf-8" }));
  await screen.findByText("12 hero entries · 12 matched to catalog · 0 require catalog review · 0 parsing errors");
  expect(screen.queryByRole("heading", { name: "Catalog entries requiring review" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Parsing errors" })).toBeNull();
  expect((screen.getByLabelText("Roster import mode") as HTMLSelectElement).value).toBe("merge");
  expect(loadProfiles(storage).profiles[0]).toEqual(p);
  expect((screen.getByRole("button", { name: "Import roster into Plural Test" }) as HTMLButtonElement).disabled).toBe(false);
  await user.click(screen.getByRole("button", { name: "Import roster into Plural Test" }));
  expect(loadProfiles(storage).profiles[0].ownedHeroes.find(h => h.heroId === "Iwado")?.stars).toBe(4);
});



it("uses percentages as the normal workflow and rejects ratios that do not total 100", async () => {
  const user = userEvent.setup(); render(<App storage={memory([completeProfile()])} />); await ready();
  expect(screen.queryByRole("spinbutton", { name: /count|troop total|Minimum Shieldbearer/i })).toBeNull();
  await fill("Shared Shooter percentage", 70);
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  expect(screen.queryByRole("article", { name: "Formation 1" })).toBeNull();
  await fill("Shared Shooter percentage", 80);
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  const first = await screen.findByRole("article", { name: "Formation 1" });
  expect(within(first).getAllByText("100% total")).toHaveLength(3);
  expect(first.querySelectorAll(".team-ratios b")).toHaveLength(9);
  expect(first.querySelectorAll(".team-ratios small")).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Independent" }));
  await fill("Team 2 Bomber percentage", 25); await fill("Team 2 Shooter percentage", 75);
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  const independent = await screen.findByRole("article", { name: "Formation 1" });
  expect(within(independent).getAllByText("25%")).toHaveLength(1);
  expect(within(independent).getAllByText("75%")).toHaveLength(1);
});


it("enables robot selection only for Cyber and Warlord across all seven events without losing saved robots", async () => {
  const p = completeProfile(); p.teamRobotIds = ["Synthetic robot", null, null];
  const storage = memory([p]), user = userEvent.setup(); render(<App storage={storage} />); await ready();
  for (const event of eventData.events) {
    await user.click(screen.getByRole("button", { name: `${event.day} ${event.name}` }));
    const enabled = ["cyber", "warlord"].includes(event.id);
    expect(screen.queryAllByRole("group", { name: /Team [123] robot/ })).toHaveLength(enabled ? 3 : 0);
    expect(screen.queryAllByLabelText("Robot reuse setting")).toHaveLength(enabled ? 1 : 0);
    if (enabled) expect(within(screen.getByRole("group", { name: "Team 1 robot" })).getByRole("button", { name: /Synthetic robot/ }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Player profiles" }));
    expect(!!screen.queryByRole("heading", { name: "Owned robots" })).toBe(enabled);
    await user.click(screen.getByRole("button", { name: "Formation generator" }));
    expect(loadProfiles(storage).profiles[0]).toEqual(p);
  }
});

it("enables guide tiers by default, permits opt-out, and leaves stored progression and history untouched", async () => {
  const { BATTLE_KEY, emptyBattle } = await import("./battles");
  const p = completeProfile(), storage = memory([p]), record = emptyBattle("retained", p.serverNumber!, "space");
  record.damage = 100; storage.setItem(BATTLE_KEY, JSON.stringify({ version: 1, records: [record] }));
  const beforeProfiles = storage.getItem(STORAGE_KEY), beforeHistory = storage.getItem(BATTLE_KEY);
  const user = userEvent.setup(); render(<App storage={storage} />); await ready();
  const checkbox = screen.getByRole("checkbox", { name: /Use provisional Gorilla Legion hero tiers/ });
  expect((checkbox as HTMLInputElement).checked).toBe(true);
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  const first = await screen.findByRole("article", { name: "Formation 1" });
  expect(first.querySelector(".score strong")?.textContent).toBe("33");
  expect(within(first).getByRole("heading", { name: "Unranked Formation" })).toBeTruthy();
  await user.click(checkbox);
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  const disabled = await screen.findByRole("article", { name: "Formation 1" });
  expect(disabled.querySelector(".score strong")?.textContent).toBe("0");
  expect(storage.getItem(STORAGE_KEY)).toBe(beforeProfiles); expect(storage.getItem(BATTLE_KEY)).toBe(beforeHistory);
});

it("makes unknown season eligibility visible and includes owned guide-class Bombers without changing stored progression", async () => {
  const p = completeProfile(); p.ownedHeroes.push({ heroId: "Lunarl", stars: 5, skillLevels: {}, equipment: [] });
  const storage = memory([p]), before = storage.getItem(STORAGE_KEY), user = userEvent.setup();
  render(<App storage={storage} />); await ready();
  const audit = screen.getByText("Owned hero eligibility audit"); await user.click(audit);
  expect(screen.getByText(/Lunarl: Included provisionally: season eligibility is unknown/)).toBeTruthy();
  await user.click(screen.getByRole("button", { name: /Generate Formations/ }));
  const result = await screen.findByRole("article", { name: "Formation 1" });
  expect(within(result).getByText(/Exact additive class-assignment search/)).toBeTruthy();
  expect(storage.getItem(STORAGE_KEY)).toBe(before);
});

it("uses the exact seven visible event names and separates boosted categories", async () => {
  const user = userEvent.setup(); render(<App storage={memory()} />); await ready();
  const names = ["Space Gorilla", "Wise Gorilla", "Cyber Gorilla", "Primal Gorilla", "Armed Gorilla", "Treasure Gorilla", "Gorilla Warlord"];
  const selectors = within(screen.getByRole("group", { name: "Gorilla event" })).getAllByRole("button");
  expect(selectors.map(b => b.querySelector("strong")?.textContent)).toEqual(names);
  for (let i = 0; i < names.length; i++) {
    await user.click(selectors[i]);
    expect(screen.getByRole("heading", { name: names[i] })).toBeTruthy();
  }
  expect(screen.getByText("Prisoner Power Armor", { exact: true })).toBeTruthy();
  expect(screen.getByText("Hero Equipment", { exact: true })).toBeTruthy();
  expect(screen.getByText("Trove Collection", { exact: true })).toBeTruthy();
});

it("saves and applies a ratio experiment to candidate 4 without selecting new heroes, then logs the exact ratio mode", async () => {
  const { loadBattles } = await import("./battles"); const { loadRatioCandidates,RATIO_TEST_KEY } = await import("./ratio-testing");
  const profile=completeProfile(),storage=memory([profile]),before=storage.getItem(STORAGE_KEY),user=userEvent.setup();
  render(<App storage={storage} />);await ready();await user.click(screen.getByRole("button",{name:/Generate Formations/}));
  await screen.findByRole("article",{name:"Formation 1"});await user.click(screen.getByRole("button",{name:"Show 4 Alternative Formations"}));
  const original=screen.getByRole("article",{name:"Formation 4"});const names=[...original.querySelectorAll(".hero-position strong")].map(n=>n.textContent);
  await user.selectOptions(screen.getByLabelText("Formation to test"),"3");
  await user.click(screen.getByText("Create or save a ratio candidate"));
  await user.type(screen.getByLabelText("Candidate name"),"Space 4/96 test");
  const bomber=screen.getByLabelText("Candidate Shared bomber percentage"),shooter=screen.getByLabelText("Candidate Shared shooter percentage");
  await user.clear(bomber);await user.type(bomber,"4");await user.clear(shooter);await user.type(shooter,"96");
  expect(storage.getItem(RATIO_TEST_KEY)).toBeNull();await user.click(screen.getByRole("button",{name:"Save ratio candidate"}));
  expect(loadRatioCandidates(storage)).toHaveLength(1);expect(storage.getItem(STORAGE_KEY)).toBe(before);
  await user.click(screen.getByRole("button",{name:"Apply edited percentages"}));
  await user.click(screen.getByRole("button",{name:"Show 4 Alternative Formations"}));
  const changed=screen.getByRole("article",{name:"Formation 4"});
  expect([...changed.querySelectorAll(".hero-position strong")].map(n=>n.textContent)).toEqual(names);
  expect(within(changed).getAllByText("4%")).toHaveLength(3);expect(loadBattles(storage)).toEqual([]);
  await user.click(within(changed).getByRole("button",{name:"Log an attack with this setup"}));
  await user.type(screen.getByLabelText("Reported damage"),"125");await user.click(screen.getByText("Ratio-test conditions and optional time"));
  await user.type(screen.getByLabelText("Battle time (ISO with timezone, optional)"),"2026-10-24T12:30:00-04:00");
  await user.type(screen.getByLabelText("Test group identifier"),"R1");await user.type(screen.getByLabelText("Relevant setup conditions"),"Same boss, troop tier and event upgrades; progression checked.");
  await user.click(screen.getByRole("checkbox",{name:/I confirm the recorded relevant setup conditions/}));await user.click(screen.getByRole("button",{name:"Save battle record"}));
  const record=loadBattles(storage)[0];expect(record.ratios).toEqual({mode:"Shared",ratio:{shield:0,bomber:4,shooter:96}});
  expect(record.formation?.flatMap(t=>[t.Left,t.Middle,t.Right])).toEqual(names);
  expect(record.observedAt).toBe("2026-10-24T12:30:00-04:00");expect(record.testConditions?.group).toBe("R1");expect(record.robotIds).toEqual([null,null,null]);
  expect(storage.getItem(STORAGE_KEY)).toBe(before);
});
it("prioritizes generation and formation results before ratio tools and a collapsed schedule",async()=>{
 render(<App storage={memory([completeProfile()])} />);await ready();
 const events=screen.getByRole("region",{name:"Choose your event"}),results=screen.getByRole("region",{name:"Formation results"}),testing=screen.getByRole("region",{name:"Troop Ratio Testing"});
 const schedule=screen.getByText("Server schedule & 14-day rotation").parentElement as HTMLDetailsElement;
 expect(schedule.open).toBe(false);expect(events.compareDocumentPosition(results)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(results.compareDocumentPosition(testing)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();expect(testing.compareDocumentPosition(schedule)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getByText("Server Time (ST)").closest(".schedule-disclosure")).toBe(schedule);
 const shortcuts=screen.getByRole("navigation",{name:"Generator shortcuts"});expect(within(shortcuts).getByRole("link",{name:/Formation results/}).getAttribute("href")).toBe("#formation-results");expect(within(shortcuts).getByRole("link",{name:"Troop ratios"}).getAttribute("href")).toBe("#ratios-title");
});
it("expands and collapses the full clock without changing formations, ratios, profiles or history",async()=>{
 const storage=memory([completeProfile()]),before=storage.getItem(STORAGE_KEY),user=userEvent.setup();storage.setItem("gorillalab.battles.v1","unchanged history");render(<App storage={storage} />);await ready();await user.click(screen.getByRole("button",{name:/Generate Formations/}));
 const result=await screen.findByRole("article",{name:"Formation 1"}),html=result.innerHTML;
 const summary=screen.getByText("Server schedule & 14-day rotation"),schedule=summary.parentElement as HTMLDetailsElement;await user.click(summary);expect(schedule.open).toBe(true);expect(within(schedule).getByRole("timer")).toBeTruthy();expect(within(schedule).getByText("Advanced clock settings")).toBeTruthy();await user.click(summary);expect(schedule.open).toBe(false);
 expect(result.innerHTML).toBe(html);expect(within(result).getAllByRole("region",{name:/Formation 1 team/})).toHaveLength(3);expect((screen.getByLabelText("Shared Bomber percentage") as HTMLInputElement).value).toBe("20");expect(storage.getItem(STORAGE_KEY)).toBe(before);expect(storage.getItem("gorillalab.battles.v1")).toBe("unchanged history");
});
it("brings all three generated teams into view and keeps owned heroes one shortcut away",async()=>{
 const user=userEvent.setup(),scroll=vi.fn(),original=HTMLElement.prototype.scrollIntoView;HTMLElement.prototype.scrollIntoView=scroll;
 try{render(<App storage={memory([completeProfile()])} />);await ready();await user.click(screen.getByRole("button",{name:/Generate Formations/}));const first=await screen.findByRole("article",{name:"Formation 1"});expect(scroll).toHaveBeenCalled();expect(within(first).getAllByRole("heading",{name:/Team [123] —/}).map(n=>n.textContent)).toEqual(["Team 1 — TOP IN GAME","Team 2 — MIDDLE IN GAME","Team 3 — BOTTOM IN GAME"]);await user.click(within(screen.getByRole("navigation",{name:"Generator shortcuts"})).getByRole("button",{name:"Owned heroes"}));expect(screen.getByRole("heading",{name:/Your heroes/})).toBeTruthy();}finally{if(original)HTMLElement.prototype.scrollIntoView=original;else delete (HTMLElement.prototype as any).scrollIntoView;}
});
it("opens the existing damage-recording interface from the optional tip without saving data",async()=>{
 const {loadBattles}=await import("./battles"),storage=memory([completeProfile()]),before=storage.getItem(STORAGE_KEY),user=userEvent.setup();render(<App storage={storage} />);await ready();await user.click(screen.getByRole("button",{name:/Generate Formations/}));await screen.findByRole("article",{name:"Formation 1"});await user.click(screen.getByRole("button",{name:"Record Damage"}));
 expect(screen.getByRole("heading",{name:"Battle history & testing"})).toBeTruthy();expect(screen.getAllByRole("spinbutton",{name:"Reported damage"})).toHaveLength(1);expect((screen.getByLabelText("Generated formation snapshot") as HTMLSelectElement).value).toBe("0");expect((screen.getByRole("checkbox",{name:/Attach generated individual formation/}) as HTMLInputElement).checked).toBe(true);expect((screen.getByLabelText("Reported damage") as HTMLInputElement).value).toBe("");expect(storage.getItem(STORAGE_KEY)).toBe(before);expect(loadBattles(storage)).toEqual([]);
});

it("renders the command center with all seven accessible portrait selectors", async () => {
  render(<App storage={memory()} />); await ready();
  expect(screen.getByRole("heading", { level: 1, name: "GorillaLab Command Center" })).toBeTruthy();
  const group = screen.getByRole("group", { name: "Gorilla event" });
  for (const event of eventData.events) {
    const button = within(group).getByRole("button", { name: `${event.day} ${event.name}` });
    expect(within(button).getByRole("img").getAttribute("src")).toBe(`/gorillas/${event.id}.png`);
  }
});
