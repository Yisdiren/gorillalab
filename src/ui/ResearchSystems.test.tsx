// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BattleHistory } from "./BattleHistory";
import { OptimizationPanel } from "./OptimizationPanel";
import { HeroProgress, RobotManager } from "./PlayerManagement";
import { eventData } from "../data/events";
import { heroCatalog } from "../data/catalog";
import { loadBattles } from "../battles";
import { systemProfile, systemStorage } from "../test/system-fixtures";
import { classifiedFixture } from "../test/fixtures";
import { useState } from "react";
import type { PlayerProfile } from "../profiles";
afterEach(cleanup);

it("records a manual five-attack total with its entered date, preserving unknown metadata and separate server scope", async () => {
  const storage = systemStorage(), user = userEvent.setup();
  render(<BattleHistory storage={storage} profile={systemProfile()} snapshot={null} />);
  const server = screen.getByLabelText("Server to view / import");
  await user.clear(server); await user.type(server, "260");
  await user.selectOptions(screen.getByLabelText("Gorilla type"), "primal");
  await user.type(screen.getByLabelText("Battle date (blank = unknown)"), "2026-10-14");
  await user.type(screen.getByLabelText("Reported damage"), "998882384");
  await user.selectOptions(screen.getByLabelText("Attack aggregation"), "five-attack-total");
  await user.click(screen.getByRole("button", { name: "Save battle record" }));
  const records = loadBattles(storage);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ server: 260, eventId: "primal", date: "2026-10-14", damage: 998882384, attackKind: "five-attack-total", attackCount: 5, formation: null, robotIds: null, progressionSnapshot: null });
  expect(screen.getByText("998,882,384")).toBeTruthy();
  await user.clear(server); await user.type(server, "10004");
  expect(screen.queryByText("998,882,384")).toBeNull();
});
it("compares feasible plans in the UI without saving or applying planned data automatically", async () => {
  const user = userEvent.setup(); const storage = systemStorage(); const applied: unknown[] = [];
  render(<OptimizationPanel profile={systemProfile()} event={eventData.events[0]} catalog={classifiedFixture} ratios={{ mode: "Shared", ratio: { shield: 0, bomber: 20, shooter: 80 } }} totals={[100000, 100000, 100000]} minimum={null} community={false} storage={storage} apply={plan => applied.push(plan)} />);
  await user.click(screen.getByRole("button", { name: /Compare candidate ratios/ }));
  expect(screen.getAllByRole("heading", { name: /Test plan/ })).toHaveLength(5);
  expect(applied).toEqual([]); expect(loadBattles(storage)).toEqual([]);
  await user.click(screen.getAllByRole("button", { name: /Use planned setup/ })[0]);
  expect(applied).toHaveLength(1);
  expect(screen.getAllByText(/Matching observed damage: unavailable/)).toHaveLength(5);
});
it("edits robot level/core and exclusive equipment without inventing their combat effects", async () => {
  function Editor() {
    const [p, setP] = useState(() => { const profile = systemProfile(); profile.ownedRobots = [{ robotId: "Synthetic robot", upgrades: {} }]; return profile; });
    const edit = (action: (profile: PlayerProfile) => void) => setP(previous => { const next = structuredClone(previous); action(next); return next; });
    return <><RobotManager profile={p} edit={edit} /><HeroProgress hero={heroCatalog[0]} profile={p} owned={p.ownedHeroes[0]} edit={edit} /><output data-testid="edited-progress">{JSON.stringify(p)}</output></>;
  }
  const user = userEvent.setup(); render(<Editor />);
  await user.click(screen.getByText((_, element) => element?.tagName === "SUMMARY" && !!element.textContent?.startsWith("Synthetic robot")));
  await user.type(screen.getByLabelText("Robot level"), "10");
  await user.type(screen.getByLabelText("Core name"), "Synthetic core");
  await user.click(screen.getByRole("button", { name: "Add core" }));
  await user.type(screen.getByLabelText("Synthetic core core level"), "3");
  await user.type(screen.getByLabelText("Exclusive equipment name"), "User equipment entry");
  await user.type(screen.getByLabelText("Exclusive equipment level"), "2");
  const state = JSON.parse(screen.getByTestId("edited-progress").textContent!);
  expect(state.ownedRobots[0]).toMatchObject({ level: 10, cores: { "Synthetic core": 3 } });
  expect(state.ownedHeroes[0].exclusiveEquipment).toMatchObject({ name: "User equipment entry", level: 2 });
});
it("refuses a cross-server UI import without changing personal records", async () => {
  const { emptyBattle, exportBattleJSON } = await import("../battles");
  const storage = systemStorage(), user = userEvent.setup();
  render(<BattleHistory storage={storage} profile={systemProfile()} snapshot={null} />);
  const text = exportBattleJSON([emptyBattle("other-server", 260, "space")], 260);
  const file = new File([text], "battles.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => text });
  await user.upload(screen.getByLabelText("Import JSON or CSV"), file);
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("another server"));
  expect(loadBattles(storage)).toEqual([]);
  expect((screen.getByLabelText("Import JSON or CSV") as HTMLInputElement).value).toBe("");
});


it("clears stale optimizer output after profile or robot context changes and shows guide baselines beside plans", async () => {
  const user = userEvent.setup(), storage = systemStorage();
  const props = { profile: systemProfile(), event: eventData.events[0], catalog: classifiedFixture, ratios: { mode: "Shared" as const, ratio: { shield: 0, bomber: 20, shooter: 80 } }, totals: [100000, 100000, 100000] as [number, number, number], minimum: null, community: false, storage, apply: () => {} };
  const { rerender } = render(<OptimizationPanel {...props} />);
  await user.click(screen.getByRole("button", { name: /Compare candidate ratios/ }));
  expect(screen.getAllByLabelText("Candidate and guide ratios")).toHaveLength(5);
  expect(screen.getAllByText("Guide baseline · Space Gorilla")).toHaveLength(5);
  const updated = structuredClone(props.profile); updated.ownedRobots = [{ robotId: "New owned fixture robot", upgrades: {} }];
  updated.teamRobotIds = ["New owned fixture robot", null, null];
  rerender(<OptimizationPanel {...props} profile={updated} />);
  expect(screen.queryByRole("button", { name: /Use planned setup/ })).toBeNull();
  expect(screen.queryByRole("heading", { name: /Test plan 1/ })).toBeNull();
});

it("commits native date input events and keeps unknown older records unchanged", async () => {
  const storage = systemStorage(), user = userEvent.setup();
  render(<BattleHistory storage={storage} profile={systemProfile()} snapshot={null} />);
  fireEvent.input(screen.getByLabelText("Battle date (blank = unknown)"), { target: { value: "2026-10-20" } });
  await user.type(screen.getByLabelText("Reported damage"), "123");
  await user.selectOptions(screen.getByLabelText("Attack aggregation"), "individual");
  await user.click(screen.getByRole("button", { name: "Save battle record" }));
  expect(loadBattles(storage)[0].date).toBe("2026-10-20");
  expect(screen.getByText("2026-10-20")).toBeTruthy();
  await user.click(screen.getByText("View record"));
  expect(screen.getByText("Formation unknown.")).toBeTruthy();
  expect(screen.getByText("Progression snapshot unknown.")).toBeTruthy();
});

it.each(eventData.events)("shows robot optimizer controls and details only when allowed: $id", async event => {
  const user = userEvent.setup(); const enabled = ["cyber", "warlord"].includes(event.id);
  const profile = systemProfile(); profile.ownedRobots = [{ robotId: "Owned fixture", upgrades: { module: 5 }, level: 10 }];
  profile.teamRobotIds = ["Owned fixture", null, null]; const before = structuredClone(profile);
  render(<OptimizationPanel profile={profile} event={event} catalog={classifiedFixture} ratios={{ mode: "Shared", ratio: event.startingRatio }} community={false} storage={systemStorage()} apply={() => {}} />);
  expect(!!screen.queryByLabelText("Robot reuse setting")).toBe(enabled);
  await user.click(screen.getByRole("button", { name: enabled ? "Compare candidate ratios & robots" : "Compare candidate ratios" }));
  expect(screen.getAllByRole("heading", { name: /Test plan/ })).toHaveLength(5);
  expect(screen.queryAllByText("Robot effect evidence")).toHaveLength(enabled ? 5 : 0);
  expect(screen.queryAllByText(/^Robots:/)).toHaveLength(enabled ? 5 : 0);
  expect(screen.queryAllByText(/robot configurations/)).toHaveLength(enabled ? 1 : 0);
  expect(profile).toEqual(before);
});


it("uses all seven display names for stored history and comparison choices without rewriting IDs", async () => {
  const { saveBattle, emptyBattle, BATTLE_KEY } = await import("../battles");
  const { within } = await import("@testing-library/react");
  const storage = systemStorage(), profile = systemProfile(), user = userEvent.setup();
  const names = ["Space Gorilla", "Wise Gorilla", "Cyber Gorilla", "Primal Gorilla", "Armed Gorilla", "Treasure Gorilla", "Gorilla Warlord"];
  eventData.events.forEach((event, i) => { const battle = emptyBattle(`label-${event.id}`, profile.serverNumber!, event.id); battle.damage = 100 + i; saveBattle(storage, battle); });
  const before = storage.getItem(BATTLE_KEY);
  render(<BattleHistory storage={storage} profile={profile} snapshot={null} />);
  const eventSelect = screen.getByLabelText("Gorilla type");
  expect(within(eventSelect).getAllByRole("option").map(o => o.textContent)).toEqual(names);
  names.forEach((name, i) => {
    expect(screen.getByRole("cell", { name })).toBeTruthy();
    for (const label of ["First battle", "Second battle"]) {
      const option = within(screen.getByLabelText(label)).getByRole("option", { name: `${name} · date unknown · ${100 + i}` });
      expect((option as HTMLOptionElement).value).toBe(`label-${eventData.events[i].id}`);
    }
  });
  await user.selectOptions(screen.getByLabelText("First battle"), "label-space");
  await user.selectOptions(screen.getByLabelText("Second battle"), "label-wise");
  expect(storage.getItem(BATTLE_KEY)).toBe(before);
  expect(loadBattles(storage).map(r => r.eventId)).toEqual(eventData.events.map(e => e.id));
});
